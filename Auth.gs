/**
 * DriveX 認証処理
 * パスワード、ログイン、ロック、セッション、履歴、リセット申請を管理します。
 */

const AUTH_CONFIG = Object.freeze({
  USERS_SHEET: 'Users',
  LOGIN_LOG_SHEET: 'LoginLog',
  RESET_REQUESTS_SHEET: 'ResetRequests',
  SETTINGS_SHEET: 'Settings',

  PEPPER_KEY: 'DRIVEX_AUTH_PEPPER',
  INITIALIZED_KEY: 'DRIVEX_AUTH_INITIALIZED',
  SESSION_PREFIX: 'DRIVEX_SESSION_',

  HASH_ITERATIONS: 10000,
  MAX_SESSION_SECONDS: 21600,

  DEFAULTS: Object.freeze({
    MAX_LOGIN_FAILURES: 5,
    LOCK_DURATION_MINUTES: 30,
    SESSION_TTL_HOURS: 1,
    REMEMBER_SESSION_TTL_HOURS: 6
  }),

  INITIAL_ADMIN: Object.freeze({
    userId: 'DrivexAdmin001',
    displayName: 'DriveX 管理者',
    password: 'Drivexpas001',
    role: 'ADMIN'
  })
});

const AUTH_HEADERS = Object.freeze({
  USERS: [
    'UserId',
    'DisplayName',
    'Email',
    'Role',
    'PasswordHash',
    'PasswordSalt',
    'IsActive',
    'FailedAttempts',
    'LockedAt',
    'MustChangePassword',
    'CreatedAt',
    'UpdatedAt',
    'LastLoginAt',
    'FavoritesJson',
    'TrashJson'
  ],

  LOGIN_LOG: [
    'LogId',
    'Timestamp',
    'UserId',
    'EventType',
    'Result',
    'Detail',
    'SessionId'
  ],

  RESET_REQUESTS: [
    'RequestId',
    'UserId',
    'Status',
    'RequestedAt',
    'ReviewedAt',
    'ReviewedBy',
    'AdminNote',
    'TemporaryPasswordHash',
    'TemporaryPasswordSalt',
    'ExpiresAt'
  ],

  SETTINGS: [
    'Key',
    'Value',
    'UpdatedAt'
  ]
});

/**
 * DriveXの認証初期設定を行います。
 * Code.gs の setupDriveX から呼び出されます。
 */
function initializeAuthentication_() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const spreadsheet = getDriveXSpreadsheet_();

    ensureSheetHeaders_(spreadsheet, AUTH_CONFIG.USERS_SHEET, AUTH_HEADERS.USERS);
    ensureSheetHeaders_(spreadsheet, AUTH_CONFIG.LOGIN_LOG_SHEET, AUTH_HEADERS.LOGIN_LOG);
    ensureSheetHeaders_(
      spreadsheet,
      AUTH_CONFIG.RESET_REQUESTS_SHEET,
      AUTH_HEADERS.RESET_REQUESTS
    );
    ensureSheetHeaders_(spreadsheet, AUTH_CONFIG.SETTINGS_SHEET, AUTH_HEADERS.SETTINGS);

    ensureDefaultAuthSettings_();
    getOrCreateAuthPepper_();
    createInitialAdminIfNeeded_();

    PropertiesService.getScriptProperties().setProperty(
      AUTH_CONFIG.INITIALIZED_KEY,
      'true'
    );
  } finally {
    lock.releaseLock();
  }
}

/**
 * ログイン処理。
 *
 * @param {string} userId ユーザーID
 * @param {string} password パスワード
 * @param {boolean} rememberMe ログイン状態を保持するか
 * @return {Object} ログイン結果
 */
function loginUser(userId, password, rememberMe) {
  const normalizedUserId = normalizeUserId_(userId);

  if (!normalizedUserId || typeof password !== 'string' || !password) {
    return {
      success: false,
      message: 'ユーザーIDまたはパスワードが正しくありません。'
    };
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    requireAuthenticationInitialized_();

    const user = findUserById_(normalizedUserId);

    if (!user || !toBoolean_(user.data.IsActive)) {
      recordLoginEvent_(normalizedUserId, 'LOGIN', 'FAILURE', '認証失敗', '');

      return {
        success: false,
        message: 'ユーザーIDまたはパスワードが正しくありません。'
      };
    }

    if (isLocked_(user.data)) {
      recordLoginEvent_(user.data.UserId, 'LOGIN', 'LOCKED', 'アカウントはロック中です。', '');

      return {
        success: false,
        message: 'アカウントがロックされています。管理者へ連絡してください。'
      };
    }

    if (user.data.LockedAt) {
      updateUserFields_(user.rowNumber, {
        FailedAttempts: 0,
        LockedAt: '',
        UpdatedAt: new Date()
      });
      user.data.FailedAttempts = 0;
    }

    const passwordHash = hashPassword_(password, user.data.PasswordSalt);

    if (!safeStringEquals_(passwordHash, String(user.data.PasswordHash))) {
      const failedAttempts = Number(user.data.FailedAttempts || 0) + 1;
      const maxFailures = getAuthSettingNumber_('MAX_LOGIN_FAILURES');

      const fields = {
        FailedAttempts: failedAttempts,
        UpdatedAt: new Date()
      };

      if (failedAttempts >= maxFailures) {
        fields.LockedAt = new Date();
      }

      updateUserFields_(user.rowNumber, fields);

      recordLoginEvent_(
        user.data.UserId,
        'LOGIN',
        failedAttempts >= maxFailures ? 'LOCKED' : 'FAILURE',
        '認証失敗',
        ''
      );

      return {
        success: false,
        message: failedAttempts >= maxFailures
          ? 'アカウントがロックされました。管理者へ連絡してください。'
          : 'ユーザーIDまたはパスワードが正しくありません。'
      };
    }

    updateUserFields_(user.rowNumber, {
      FailedAttempts: 0,
      LockedAt: '',
      LastLoginAt: new Date(),
      UpdatedAt: new Date()
    });

    const session = createSession_(user.data, Boolean(rememberMe));

    recordLoginEvent_(
      user.data.UserId,
      'LOGIN',
      'SUCCESS',
      'ログイン成功',
      session.id
    );

    return {
      success: true,
      message: 'ログインしました。',
      sessionToken: session.token,
      expiresAt: session.expiresAt,
      user: getPublicUser_(user.data)
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * ログアウト処理。
 *
 * @param {string} sessionToken セッショントークン
 * @return {{success: boolean}} 実行結果
 */
function logoutUser(sessionToken) {
  const session = getSession_(sessionToken);

  if (session) {
    CacheService.getScriptCache().remove(getSessionCacheKey_(sessionToken));

    recordLoginEvent_(
      session.userId,
      'LOGOUT',
      'SUCCESS',
      'ログアウト',
      session.id
    );
  }

  return {success: true};
}

/**
 * セッションの有効性を確認します。
 *
 * @param {string} sessionToken セッショントークン
 * @return {Object} 認証状態
 */
function getAuthenticationStatus(sessionToken) {
  const session = getSession_(sessionToken);

  if (!session) {
    return {
      authenticated: false,
      user: null,
      expiresAt: null
    };
  }

  const user = findUserById_(session.userId);

  if (!user || !toBoolean_(user.data.IsActive)) {
    CacheService.getScriptCache().remove(getSessionCacheKey_(sessionToken));

    return {
      authenticated: false,
      user: null,
      expiresAt: null
    };
  }

  return {
    authenticated: true,
    user: getPublicUser_(user.data),
    expiresAt: session.expiresAt
  };
}

/**
 * パスワードリセットを申請します。
 * リセット実行は後で Admin.gs から管理者が承認します。
 *
 * @param {string} userId ユーザーID
 * @return {{success: boolean, message: string}} 申請結果
 */
function requestPasswordReset(userId) {
  const normalizedUserId = normalizeUserId_(userId);

  if (!normalizedUserId) {
    return {
      success: false,
      message: 'ユーザーIDを入力してください。'
    };
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    requireAuthenticationInitialized_();

    const user = findUserById_(normalizedUserId);

    if (
      user &&
      toBoolean_(user.data.IsActive) &&
      !hasPendingResetRequest_(user.data.UserId)
    ) {
      getRequiredSheet_(AUTH_CONFIG.RESET_REQUESTS_SHEET).appendRow([
        Utilities.getUuid(),
        user.data.UserId,
        'PENDING',
        new Date(),
        '',
        '',
        '',
        '',
        '',
        ''
      ]);
    }

    return {
      success: true,
      message: '再設定申請を受け付けました。管理者の承認をお待ちください。'
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Admin.gs・User.gs用のパスワードハッシュ生成処理です。
 *
 * @param {string} password 平文パスワード
 * @return {{hash: string, salt: string}} ハッシュ情報
 */
function createPasswordCredentials_(password) {
  validatePassword_(password);

  const salt = generateSecureToken_();

  return {
    hash: hashPassword_(password, salt),
    salt: salt
  };
}

function requireAuthenticationInitialized_() {
  const initialized = PropertiesService.getScriptProperties()
    .getProperty(AUTH_CONFIG.INITIALIZED_KEY);

  if (initialized !== 'true') {
    throw new Error('初期設定が未完了です。setupDriveX を実行してください。');
  }
}

function ensureSheetHeaders_(spreadsheet, sheetName, headers) {
  const sheet = spreadsheet.getSheetByName(sheetName) || spreadsheet.insertSheet(sheetName);

  const currentHeaders = sheet
    .getRange(1, 1, 1, headers.length)
    .getValues()[0];

  const isEmpty = currentHeaders.every(function(value) {
    return value === '';
  });

  if (isEmpty) {
    sheet
      .getRange(1, 1, 1, headers.length)
      .setValues([headers])
      .setFontWeight('bold');

    sheet.setFrozenRows(1);
    return;
  }

  const isDifferent = headers.some(function(header, index) {
    return currentHeaders[index] !== header;
  });

  if (isDifferent) {
    throw new Error(sheetName + ' シートのヘッダーがDriveXの定義と一致しません。');
  }
}

function ensureDefaultAuthSettings_() {
  Object.keys(AUTH_CONFIG.DEFAULTS).forEach(function(key) {
    if (getAuthSettingValue_(key) === null) {
      setAuthSetting_(key, AUTH_CONFIG.DEFAULTS[key]);
    }
  });
}

function createInitialAdminIfNeeded_() {
  if (findUserById_(AUTH_CONFIG.INITIAL_ADMIN.userId)) {
    return;
  }

  const credentials = createPasswordCredentials_(
    AUTH_CONFIG.INITIAL_ADMIN.password
  );

  getRequiredSheet_(AUTH_CONFIG.USERS_SHEET).appendRow([
    AUTH_CONFIG.INITIAL_ADMIN.userId,
    AUTH_CONFIG.INITIAL_ADMIN.displayName,
    '',
    AUTH_CONFIG.INITIAL_ADMIN.role,
    credentials.hash,
    credentials.salt,
    true,
    0,
    '',
    true,
    new Date(),
    new Date(),
    '',
    '[]',
    '[]'
  ]);
}

function findUserById_(userId) {
  const sheet = getRequiredSheet_(AUTH_CONFIG.USERS_SHEET);
  const values = sheet.getDataRange().getValues();

  if (values.length < 2) {
    return null;
  }

  const headers = values[0];
  const normalizedUserId = String(userId).toLowerCase();

  for (let rowIndex = 1; rowIndex < values.length; rowIndex++) {
    if (String(values[rowIndex][0]).toLowerCase() === normalizedUserId) {
      return {
        rowNumber: rowIndex + 1,
        data: rowToObject_(headers, values[rowIndex])
      };
    }
  }

  return null;
}

function updateUserFields_(rowNumber, fields) {
  const sheet = getRequiredSheet_(AUTH_CONFIG.USERS_SHEET);
  const headers = sheet
    .getRange(1, 1, 1, sheet.getLastColumn())
    .getValues()[0];

  Object.keys(fields).forEach(function(key) {
    const columnIndex = headers.indexOf(key);

    if (columnIndex === -1) {
      throw new Error('Usersシートに列がありません: ' + key);
    }

    sheet.getRange(rowNumber, columnIndex + 1).setValue(fields[key]);
  });
}

function isLocked_(user) {
  if (!user.LockedAt) {
    return false;
  }

  const lockedAt = new Date(user.LockedAt).getTime();
  const lockMilliseconds = getAuthSettingNumber_('LOCK_DURATION_MINUTES') * 60 * 1000;

  return !Number.isNaN(lockedAt) && Date.now() - lockedAt < lockMilliseconds;
}

function createSession_(user, rememberMe) {
  const hours = rememberMe
    ? getAuthSettingNumber_('REMEMBER_SESSION_TTL_HOURS')
    : getAuthSettingNumber_('SESSION_TTL_HOURS');

  const seconds = Math.min(
    Math.max(1, Math.floor(hours * 60 * 60)),
    AUTH_CONFIG.MAX_SESSION_SECONDS
  );

  const token = generateSecureToken_();
  const sessionId = Utilities.getUuid();
  const expiresAt = new Date(Date.now() + seconds * 1000).toISOString();

  const sessionData = {
    id: sessionId,
    userId: user.UserId,
    role: user.Role,
    expiresAt: expiresAt
  };

  CacheService.getScriptCache().put(
    getSessionCacheKey_(token),
    JSON.stringify(sessionData),
    seconds
  );

  return {
    id: sessionId,
    token: token,
    expiresAt: expiresAt
  };
}

function getSession_(sessionToken) {
  if (typeof sessionToken !== 'string' || sessionToken.length < 20) {
    return null;
  }

  const stored = CacheService.getScriptCache()
    .get(getSessionCacheKey_(sessionToken));

  if (!stored) {
    return null;
  }

  try {
    const session = JSON.parse(stored);

    if (new Date(session.expiresAt).getTime() <= Date.now()) {
      return null;
    }

    return session;
  } catch (error) {
    return null;
  }
}

function getSessionCacheKey_(token) {
  const hash = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    token
  );

  return AUTH_CONFIG.SESSION_PREFIX + Utilities.base64EncodeWebSafe(hash);
}

function hashPassword_(password, salt) {
  const pepper = getOrCreateAuthPepper_();
  const key = String(salt) + ':' + pepper;
  let value = String(password);

  for (let index = 0; index < AUTH_CONFIG.HASH_ITERATIONS; index++) {
    value = Utilities.base64Encode(
      Utilities.computeHmacSha256Signature(value, key)
    );
  }

  return value;
}

function getOrCreateAuthPepper_() {
  const properties = PropertiesService.getScriptProperties();
  let pepper = properties.getProperty(AUTH_CONFIG.PEPPER_KEY);

  if (!pepper) {
    pepper = generateSecureToken_();
    properties.setProperty(AUTH_CONFIG.PEPPER_KEY, pepper);
  }

  return pepper;
}

function generateSecureToken_() {
  const value = [
    Utilities.getUuid(),
    Utilities.getUuid(),
    String(Date.now())
  ].join(':');

  return Utilities.base64EncodeWebSafe(
    Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value)
  );
}

function recordLoginEvent_(userId, eventType, result, detail, sessionId) {
  getRequiredSheet_(AUTH_CONFIG.LOGIN_LOG_SHEET).appendRow([
    Utilities.getUuid(),
    new Date(),
    userId,
    eventType,
    result,
    detail,
    sessionId
  ]);
}

function hasPendingResetRequest_(userId) {
  const values = getRequiredSheet_(AUTH_CONFIG.RESET_REQUESTS_SHEET)
    .getDataRange()
    .getValues();

  return values.slice(1).some(function(row) {
    return String(row[1]).toLowerCase() === String(userId).toLowerCase()
      && row[2] === 'PENDING';
  });
}

function getAuthSettingNumber_(key) {
  const value = Number(getAuthSettingValue_(key));

  if (!Number.isFinite(value) || value <= 0) {
    throw new Error('Settingsシートの設定値が不正です: ' + key);
  }

  return value;
}

function getAuthSettingValue_(key) {
  const values = getRequiredSheet_(AUTH_CONFIG.SETTINGS_SHEET)
    .getDataRange()
    .getValues();

  for (let rowIndex = 1; rowIndex < values.length; rowIndex++) {
    if (values[rowIndex][0] === key) {
      return String(values[rowIndex][1]);
    }
  }

  return null;
}

function setAuthSetting_(key, value) {
  getRequiredSheet_(AUTH_CONFIG.SETTINGS_SHEET).appendRow([
    key,
    value,
    new Date()
  ]);
}

function normalizeUserId_(value) {
  const userId = String(value || '').trim();

  return /^[A-Za-z0-9._-]{3,64}$/.test(userId)
    ? userId
    : '';
}

function validatePassword_(password) {
  if (
    typeof password !== 'string' ||
    password.length < 8 ||
    password.length > 128
  ) {
    throw new Error('パスワードは8文字以上128文字以下で設定してください。');
  }
}

function safeStringEquals_(left, right) {
  const first = String(left);
  const second = String(right);
  const length = Math.max(first.length, second.length);

  let difference = first.length ^ second.length;

  for (let index = 0; index < length; index++) {
    difference |= (first.charCodeAt(index) || 0)
      ^ (second.charCodeAt(index) || 0);
  }

  return difference === 0;
}

function rowToObject_(headers, row) {
  return headers.reduce(function(result, header, index) {
    result[header] = row[index];
    return result;
  }, {});
}

function toBoolean_(value) {
  return value === true || String(value).toLowerCase() === 'true';
}

function getPublicUser_(user) {
  return {
    userId: user.UserId,
    displayName: user.DisplayName,
    email: user.Email,
    role: user.Role,
    mustChangePassword: toBoolean_(user.MustChangePassword)
  };
}