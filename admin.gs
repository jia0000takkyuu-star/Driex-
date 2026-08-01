/**
 * DriveX 管理者機能
 * ユーザー管理、ログイン履歴、パスワードリセット承認を管理します。
 */

/**
 * ユーザー一覧を取得します。
 *
 * @param {string} sessionToken セッショントークン
 * @return {Object[]} ユーザー一覧
 */
function getAdminUserList(sessionToken) {
  requireAdminSession_(sessionToken);

  const sheet = getRequiredSheet_(AUTH_CONFIG.USERS_SHEET);
  const values = sheet.getDataRange().getValues();

  if (values.length < 2) {
    return [];
  }

  const headers = values[0];

  return values.slice(1).map(function(row) {
    return getAdminUserView_(rowToObject_(headers, row));
  });
}

/**
 * 新しいユーザーを作成します。
 *
 * @param {string} sessionToken 管理者セッショントークン
 * @param {Object} userInfo ユーザー情報
 * @return {{success: boolean, user: Object}} 作成結果
 */
function adminCreateUser(sessionToken, userInfo) {
  requireAdminSession_(sessionToken);

  const userId = normalizeUserId_(userInfo && userInfo.userId);
  const displayName = String((userInfo && userInfo.displayName) || '').trim();
  const email = String((userInfo && userInfo.email) || '').trim();
  const role = normalizeRole_(userInfo && userInfo.role);
  const password = String((userInfo && userInfo.password) || '');

  if (!userId) {
    throw new Error('ユーザーIDは英数字・ハイフン・アンダースコア・ピリオドで入力してください。');
  }

  if (!displayName || displayName.length > 100) {
    throw new Error('表示名は1文字以上100文字以下で入力してください。');
  }

  if (email && !isValidEmail_(email)) {
    throw new Error('メールアドレスの形式が正しくありません。');
  }

  validatePassword_(password);

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    if (findUserById_(userId)) {
      throw new Error('同じユーザーIDがすでに登録されています。');
    }

    const credentials = createPasswordCredentials_(password);
    const now = new Date();

    getRequiredSheet_(AUTH_CONFIG.USERS_SHEET).appendRow([
      userId,
      displayName,
      email,
      role,
      credentials.hash,
      credentials.salt,
      true,
      0,
      '',
      true,
      now,
      now,
      '',
      '[]',
      '[]'
    ]);

    const createdUser = findUserById_(userId);

    recordLoginEvent_(
      userId,
      'USER_CREATE',
      'SUCCESS',
      '管理者によるユーザー作成',
      ''
    );

    return {
      success: true,
      user: getAdminUserView_(createdUser.data)
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * ユーザーの表示名・メールアドレス・有効状態・権限を更新します。
 *
 * @param {string} sessionToken 管理者セッショントークン
 * @param {string} userId 対象ユーザーID
 * @param {Object} userInfo 更新情報
 * @return {{success: boolean, user: Object}} 更新結果
 */
function adminUpdateUser(sessionToken, userId, userInfo) {
  const admin = requireAdminSession_(sessionToken);
  const normalizedUserId = normalizeUserId_(userId);

  if (!normalizedUserId) {
    throw new Error('ユーザーIDが正しくありません。');
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const target = findUserById_(normalizedUserId);

    if (!target) {
      throw new Error('対象ユーザーが見つかりません。');
    }

    const displayName = String(
      userInfo && userInfo.displayName !== undefined
        ? userInfo.displayName
        : target.data.DisplayName
    ).trim();

    const email = String(
      userInfo && userInfo.email !== undefined
        ? userInfo.email
        : target.data.Email
    ).trim();

    const role = normalizeRole_(
      userInfo && userInfo.role !== undefined
        ? userInfo.role
        : target.data.Role
    );

    const isActive = userInfo && userInfo.isActive !== undefined
      ? Boolean(userInfo.isActive)
      : toBoolean_(target.data.IsActive);

    if (!displayName || displayName.length > 100) {
      throw new Error('表示名は1文字以上100文字以下で入力してください。');
    }

    if (email && !isValidEmail_(email)) {
      throw new Error('メールアドレスの形式が正しくありません。');
    }

    ensureAdminAccountWillRemain_(
      admin.data,
      target.data,
      role,
      isActive
    );

    updateUserFields_(target.rowNumber, {
      DisplayName: displayName,
      Email: email,
      Role: role,
      IsActive: isActive,
      UpdatedAt: new Date()
    });

    const updatedUser = findUserById_(normalizedUserId);

    recordLoginEvent_(
      normalizedUserId,
      'USER_UPDATE',
      'SUCCESS',
      '管理者によるユーザー更新',
      ''
    );

    return {
      success: true,
      user: getAdminUserView_(updatedUser.data)
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * ユーザーを削除します。
 * 最後の有効な管理者は削除できません。
 *
 * @param {string} sessionToken 管理者セッショントークン
 * @param {string} userId 対象ユーザーID
 * @return {{success: boolean}} 実行結果
 */
function adminDeleteUser(sessionToken, userId) {
  const admin = requireAdminSession_(sessionToken);
  const normalizedUserId = normalizeUserId_(userId);

  if (!normalizedUserId) {
    throw new Error('ユーザーIDが正しくありません。');
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const target = findUserById_(normalizedUserId);

    if (!target) {
      throw new Error('対象ユーザーが見つかりません。');
    }

    if (String(admin.data.UserId).toLowerCase() === String(target.data.UserId).toLowerCase()) {
      throw new Error('ログイン中の管理者アカウントは削除できません。');
    }

    ensureAdminAccountWillRemain_(
      admin.data,
      target.data,
      target.data.Role,
      false
    );

    getRequiredSheet_(AUTH_CONFIG.USERS_SHEET).deleteRow(target.rowNumber);

    recordLoginEvent_(
      target.data.UserId,
      'USER_DELETE',
      'SUCCESS',
      '管理者によるユーザー削除',
      ''
    );

    return {success: true};
  } finally {
    lock.releaseLock();
  }
}

/**
 * ロックされたユーザーを解除します。
 *
 * @param {string} sessionToken 管理者セッショントークン
 * @param {string} userId 対象ユーザーID
 * @return {{success: boolean, message: string}} 実行結果
 */
function adminUnlockUser(sessionToken, userId) {
  requireAdminSession_(sessionToken);

  const normalizedUserId = normalizeUserId_(userId);

  if (!normalizedUserId) {
    throw new Error('ユーザーIDが正しくありません。');
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const target = findUserById_(normalizedUserId);

    if (!target) {
      throw new Error('対象ユーザーが見つかりません。');
    }

    updateUserFields_(target.rowNumber, {
      FailedAttempts: 0,
      LockedAt: '',
      UpdatedAt: new Date()
    });

    recordLoginEvent_(
      target.data.UserId,
      'UNLOCK',
      'SUCCESS',
      '管理者によるロック解除',
      ''
    );

    return {
      success: true,
      message: 'アカウントのロックを解除しました。'
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * ログイン・ログアウト履歴を取得します。
 *
 * @param {string} sessionToken 管理者セッショントークン
 * @param {string} userId ユーザーID。空文字なら全ユーザー
 * @param {number} limit 取得件数
 * @return {Object[]} 履歴一覧
 */
function getAdminLoginHistory(sessionToken, userId, limit) {
  requireAdminSession_(sessionToken);

  const normalizedUserId = String(userId || '').trim().toLowerCase();
  const maxRows = Math.min(Math.max(Number(limit) || 100, 1), 500);

  const sheet = getRequiredSheet_(AUTH_CONFIG.LOGIN_LOG_SHEET);
  const values = sheet.getDataRange().getValues();

  if (values.length < 2) {
    return [];
  }

  const headers = values[0];

  return values
    .slice(1)
    .map(function(row) {
      return rowToObject_(headers, row);
    })
    .filter(function(log) {
      return !normalizedUserId ||
        String(log.UserId).toLowerCase() === normalizedUserId;
    })
    .reverse()
    .slice(0, maxRows)
    .map(function(log) {
      return {
        logId: log.LogId,
        timestamp: log.Timestamp,
        userId: log.UserId,
        eventType: log.EventType,
        result: log.Result,
        detail: log.Detail
      };
    });
}

/**
 * パスワード再設定申請一覧を取得します。
 *
 * @param {string} sessionToken 管理者セッショントークン
 * @param {string} status PENDING / APPROVED / REJECTED / 空文字
 * @return {Object[]} 申請一覧
 */
function getPasswordResetRequests(sessionToken, status) {
  requireAdminSession_(sessionToken);

  const requestedStatus = String(status || '').trim().toUpperCase();
  const sheet = getRequiredSheet_(AUTH_CONFIG.RESET_REQUESTS_SHEET);
  const values = sheet.getDataRange().getValues();

  if (values.length < 2) {
    return [];
  }

  const headers = values[0];

  return values
    .slice(1)
    .map(function(row) {
      return rowToObject_(headers, row);
    })
    .filter(function(request) {
      return !requestedStatus || request.Status === requestedStatus;
    })
    .reverse()
    .map(function(request) {
      return {
        requestId: request.RequestId,
        userId: request.UserId,
        status: request.Status,
        requestedAt: request.RequestedAt,
        reviewedAt: request.ReviewedAt,
        reviewedBy: request.ReviewedBy,
        adminNote: request.AdminNote,
        expiresAt: request.ExpiresAt
      };
    });
}

/**
 * パスワードリセットを承認し、一時パスワードを設定します。
 *
 * @param {string} sessionToken 管理者セッショントークン
 * @param {string} requestId 申請ID
 * @param {string} temporaryPassword 一時パスワード
 * @param {string} adminNote 管理者メモ
 * @return {{success: boolean, message: string}} 実行結果
 */
function approvePasswordReset(
  sessionToken,
  requestId,
  temporaryPassword,
  adminNote
) {
  const admin = requireAdminSession_(sessionToken);
  validatePassword_(temporaryPassword);

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const request = findResetRequest_(requestId);

    if (!request || request.data.Status !== 'PENDING') {
      throw new Error('承認待ちの再設定申請が見つかりません。');
    }

    const target = findUserById_(request.data.UserId);

    if (!target) {
      throw new Error('申請対象のユーザーが見つかりません。');
    }

    const credentials = createPasswordCredentials_(temporaryPassword);

    updateUserFields_(target.rowNumber, {
      PasswordHash: credentials.hash,
      PasswordSalt: credentials.salt,
      FailedAttempts: 0,
      LockedAt: '',
      MustChangePassword: true,
      UpdatedAt: new Date()
    });

    updateResetRequestFields_(request.rowNumber, {
      Status: 'APPROVED',
      ReviewedAt: new Date(),
      ReviewedBy: admin.data.UserId,
      AdminNote: String(adminNote || '').trim(),
      TemporaryPasswordHash: credentials.hash,
      TemporaryPasswordSalt: credentials.salt,
      ExpiresAt: ''
    });

    recordLoginEvent_(
      target.data.UserId,
      'PASSWORD_RESET',
      'SUCCESS',
      '管理者によるパスワードリセット承認',
      ''
    );

    return {
      success: true,
      message: 'パスワードリセットを承認しました。'
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * パスワードリセット申請を却下します。
 *
 * @param {string} sessionToken 管理者セッショントークン
 * @param {string} requestId 申請ID
 * @param {string} adminNote 管理者メモ
 * @return {{success: boolean, message: string}} 実行結果
 */
function rejectPasswordReset(sessionToken, requestId, adminNote) {
  const admin = requireAdminSession_(sessionToken);

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const request = findResetRequest_(requestId);

    if (!request || request.data.Status !== 'PENDING') {
      throw new Error('承認待ちの再設定申請が見つかりません。');
    }

    updateResetRequestFields_(request.rowNumber, {
      Status: 'REJECTED',
      ReviewedAt: new Date(),
      ReviewedBy: admin.data.UserId,
      AdminNote: String(adminNote || '').trim()
    });

    recordLoginEvent_(
      request.data.UserId,
      'PASSWORD_RESET',
      'REJECTED',
      '管理者によるパスワードリセット却下',
      ''
    );

    return {
      success: true,
      message: 'パスワードリセット申請を却下しました。'
    };
  } finally {
    lock.releaseLock();
  }
}

function findResetRequest_(requestId) {
  const normalizedRequestId = String(requestId || '').trim();
  const sheet = getRequiredSheet_(AUTH_CONFIG.RESET_REQUESTS_SHEET);
  const values = sheet.getDataRange().getValues();

  if (values.length < 2) {
    return null;
  }

  const headers = values[0];

  for (let rowIndex = 1; rowIndex < values.length; rowIndex++) {
    if (String(values[rowIndex][0]) === normalizedRequestId) {
      return {
        rowNumber: rowIndex + 1,
        data: rowToObject_(headers, values[rowIndex])
      };
    }
  }

  return null;
}

function updateResetRequestFields_(rowNumber, fields) {
  const sheet = getRequiredSheet_(AUTH_CONFIG.RESET_REQUESTS_SHEET);
  const headers = sheet
    .getRange(1, 1, 1, sheet.getLastColumn())
    .getValues()[0];

  Object.keys(fields).forEach(function(key) {
    const columnIndex = headers.indexOf(key);

    if (columnIndex === -1) {
      throw new Error('ResetRequestsシートに列がありません: ' + key);
    }

    sheet.getRange(rowNumber, columnIndex + 1).setValue(fields[key]);
  });
}

function getAdminUserView_(user) {
  return {
    userId: user.UserId,
    displayName: user.DisplayName,
    email: user.Email,
    role: user.Role,
    isActive: toBoolean_(user.IsActive),
    failedAttempts: Number(user.FailedAttempts || 0),
    lockedAt: user.LockedAt,
    mustChangePassword: toBoolean_(user.MustChangePassword),
    createdAt: user.CreatedAt,
    updatedAt: user.UpdatedAt,
    lastLoginAt: user.LastLoginAt
  };
}

function normalizeRole_(role) {
  const normalizedRole = String(role || 'USER').trim().toUpperCase();

  if (normalizedRole !== 'ADMIN' && normalizedRole !== 'USER') {
    throw new Error('権限は ADMIN または USER を指定してください。');
  }

  return normalizedRole;
}

function ensureAdminAccountWillRemain_(
  currentAdmin,
  targetUser,
  nextRole,
  nextIsActive
) {
  const targetIsActiveAdmin =
    targetUser.Role === 'ADMIN' && toBoolean_(targetUser.IsActive);

  const remainsActiveAdmin =
    nextRole === 'ADMIN' && Boolean(nextIsActive);

  if (!targetIsActiveAdmin || remainsActiveAdmin) {
    return;
  }

  const activeAdminCount = countActiveAdmins_();

  if (activeAdminCount <= 1) {
    throw new Error('最後の有効な管理者アカウントは変更・無効化・削除できません。');
  }

  if (
    String(currentAdmin.UserId).toLowerCase() ===
    String(targetUser.UserId).toLowerCase()
  ) {
    throw new Error('ログイン中の管理者アカウントは管理者権限から変更できません。');
  }
}

function countActiveAdmins_() {
  const sheet = getRequiredSheet_(AUTH_CONFIG.USERS_SHEET);
  const values = sheet.getDataRange().getValues();

  if (values.length < 2) {
    return 0;
  }

  const headers = values[0];

  return values.slice(1).reduce(function(count, row) {
    const user = rowToObject_(headers, row);

    return user.Role === 'ADMIN' && toBoolean_(user.IsActive)
      ? count + 1
      : count;
  }, 0);
}