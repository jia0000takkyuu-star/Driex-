/**
 * DriveX ユーザー機能
 * プロフィール、パスワード変更、権限、お気に入りを管理します。
 */

/**
 * ログイン中ユーザーのプロフィールを取得します。
 *
 * @param {string} sessionToken セッショントークン
 * @return {Object} ユーザー情報
 */
function getMyProfile(sessionToken) {
  const user = requireSession_(sessionToken);
  return getPublicUser_(user.data);
}

/**
 * ログイン中ユーザーの表示名・メールアドレスを更新します。
 *
 * @param {string} sessionToken セッショントークン
 * @param {Object} profile 更新内容
 * @return {{success: boolean, user: Object}} 更新結果
 */
function updateMyProfile(sessionToken, profile) {
  const sessionUser = requireSession_(sessionToken);

  const displayName = String((profile && profile.displayName) || '').trim();
  const email = String((profile && profile.email) || '').trim();

  if (!displayName || displayName.length > 100) {
    throw new Error('表示名は1文字以上100文字以下で入力してください。');
  }

  if (email && !isValidEmail_(email)) {
    throw new Error('メールアドレスの形式が正しくありません。');
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    updateUserFields_(sessionUser.rowNumber, {
      DisplayName: displayName,
      Email: email,
      UpdatedAt: new Date()
    });

    const updatedUser = findUserById_(sessionUser.data.UserId);

    return {
      success: true,
      user: getPublicUser_(updatedUser.data)
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * 自分のパスワードを変更します。
 * 初期ログイン後・リセット後のパスワード変更必須状態も解除します。
 *
 * @param {string} sessionToken セッショントークン
 * @param {string} currentPassword 現在のパスワード
 * @param {string} newPassword 新しいパスワード
 * @return {{success: boolean, message: string}} 実行結果
 */
function changeMyPassword(sessionToken, currentPassword, newPassword) {
  const sessionUser = requireSession_(sessionToken);

  if (typeof currentPassword !== 'string' || !currentPassword) {
    throw new Error('現在のパスワードを入力してください。');
  }

  validatePassword_(newPassword);

  if (currentPassword === newPassword) {
    throw new Error('現在のパスワードとは異なるパスワードを設定してください。');
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const user = findUserById_(sessionUser.data.UserId);

    const currentHash = hashPassword_(
      currentPassword,
      user.data.PasswordSalt
    );

    if (!safeStringEquals_(currentHash, String(user.data.PasswordHash))) {
      throw new Error('現在のパスワードが正しくありません。');
    }

    const credentials = createPasswordCredentials_(newPassword);

    updateUserFields_(user.rowNumber, {
      PasswordHash: credentials.hash,
      PasswordSalt: credentials.salt,
      MustChangePassword: false,
      FailedAttempts: 0,
      LockedAt: '',
      UpdatedAt: new Date()
    });

    recordLoginEvent_(
      user.data.UserId,
      'PASSWORD_CHANGE',
      'SUCCESS',
      '本人によるパスワード変更',
      ''
    );

    return {
      success: true,
      message: 'パスワードを変更しました。'
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * ログイン中ユーザーの権限情報を取得します。
 *
 * @param {string} sessionToken セッショントークン
 * @return {Object} 権限情報
 */
function getMyPermissions(sessionToken) {
  const user = requireSession_(sessionToken).data;
  const isAdmin = user.Role === 'ADMIN';

  return {
    role: user.Role,
    isAdmin: isAdmin,
    canManageUsers: isAdmin,
    canReviewPasswordResets: isAdmin,
    canManageFiles: true
  };
}

/**
 * ログイン中ユーザーのお気に入りファイルID一覧を取得します。
 *
 * @param {string} sessionToken セッショントークン
 * @return {string[]} ファイルID一覧
 */
function getMyFavoriteIds(sessionToken) {
  const user = requireSession_(sessionToken);
  return parseStoredIdList_(user.data.FavoritesJson);
}

/**
 * ファイルまたはフォルダをお気に入りに追加します。
 *
 * @param {string} sessionToken セッショントークン
 * @param {string} fileId Google DriveファイルID
 * @return {{success: boolean, favoriteIds: string[]}} 更新結果
 */
function addFavorite(sessionToken, fileId) {
  return updateFavorite_(sessionToken, fileId, true);
}

/**
 * ファイルまたはフォルダをお気に入りから外します。
 *
 * @param {string} sessionToken セッショントークン
 * @param {string} fileId Google DriveファイルID
 * @return {{success: boolean, favoriteIds: string[]}} 更新結果
 */
function removeFavorite(sessionToken, fileId) {
  return updateFavorite_(sessionToken, fileId, false);
}

/**
 * セッションを確認し、使用可能なユーザーを返します。
 * 他のサーバー側ファイルからも共通で使用します。
 *
 * @param {string} sessionToken セッショントークン
 * @return {{rowNumber: number, data: Object, session: Object}} ユーザー情報
 */
function requireSession_(sessionToken) {
  const session = getSession_(sessionToken);

  if (!session) {
    throw new Error('ログインの有効期限が切れました。もう一度ログインしてください。');
  }

  const user = findUserById_(session.userId);

  if (!user || !toBoolean_(user.data.IsActive)) {
    CacheService.getScriptCache().remove(getSessionCacheKey_(sessionToken));
    throw new Error('このアカウントは利用できません。');
  }

  return {
    rowNumber: user.rowNumber,
    data: user.data,
    session: session
  };
}

/**
 * 管理者セッションを確認します。
 *
 * @param {string} sessionToken セッショントークン
 * @return {{rowNumber: number, data: Object, session: Object}} 管理者情報
 */
function requireAdminSession_(sessionToken) {
  const user = requireSession_(sessionToken);

  if (user.data.Role !== 'ADMIN') {
    throw new Error('管理者権限が必要です。');
  }

  return user;
}

/**
 * お気に入りの追加・削除共通処理です。
 *
 * @param {string} sessionToken セッショントークン
 * @param {string} fileId Google DriveファイルID
 * @param {boolean} shouldAdd 追加する場合はtrue
 * @return {{success: boolean, favoriteIds: string[]}} 更新結果
 */
function updateFavorite_(sessionToken, fileId, shouldAdd) {
  const sessionUser = requireSession_(sessionToken);
  const normalizedFileId = String(fileId || '').trim();

  if (!/^[A-Za-z0-9_-]{10,}$/.test(normalizedFileId)) {
    throw new Error('ファイルIDが正しくありません。');
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const user = findUserById_(sessionUser.data.UserId);
    let favoriteIds = parseStoredIdList_(user.data.FavoritesJson);

    if (shouldAdd) {
      favoriteIds.push(normalizedFileId);
      favoriteIds = Array.from(new Set(favoriteIds));
    } else {
      favoriteIds = favoriteIds.filter(function(id) {
        return id !== normalizedFileId;
      });
    }

    updateUserFields_(user.rowNumber, {
      FavoritesJson: JSON.stringify(favoriteIds),
      UpdatedAt: new Date()
    });

    return {
      success: true,
      favoriteIds: favoriteIds
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * シート内に保存されたJSON配列を安全に読み込みます。
 *
 * @param {*} value JSON文字列
 * @return {string[]} ID配列
 */
function parseStoredIdList_(value) {
  try {
    const parsed = JSON.parse(String(value || '[]'));

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(function(id) {
      return typeof id === 'string';
    });
  } catch (error) {
    return [];
  }
}

/**
 * メールアドレス形式を確認します。
 *
 * @param {string} email メールアドレス
 * @return {boolean} 正しい形式ならtrue
 */
function isValidEmail_(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}