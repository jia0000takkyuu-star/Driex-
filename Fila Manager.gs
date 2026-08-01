/**
 * DriveX ファイル管理機能
 * Google Drive上のフォルダ・ファイル・検索・プレビュー・ごみ箱を管理します。
 */

const FILE_MANAGER_CONFIG = Object.freeze({
  ROOT_FOLDER_SETTING: 'ROOT_FOLDER_ID',
  ROOT_FOLDER_NAME: 'DriveX Files',
  MAX_UPLOAD_BYTES: 20 * 1024 * 1024,
  MAX_SEARCH_RESULTS: 100
});

/**
 * DriveXのルートフォルダ内を一覧表示します。
 *
 * @param {string} sessionToken セッショントークン
 * @param {string} folderId フォルダID。空ならルートフォルダ
 * @return {Object} フォルダ・ファイル一覧
 */
function listDriveItems(sessionToken, folderId) {
  requireSession_(sessionToken);

  const folder = getAccessibleFolder_(folderId);
  const folders = [];
  const files = [];

  const folderIterator = folder.getFolders();
  while (folderIterator.hasNext()) {
    folders.push(getFolderView_(folderIterator.next()));
  }

  const fileIterator = folder.getFiles();
  while (fileIterator.hasNext()) {
    files.push(getFileView_(fileIterator.next()));
  }

  folders.sort(sortByName_);
  files.sort(sortByName_);

  return {
    currentFolder: getFolderView_(folder),
    folders: folders,
    files: files
  };
}

/**
 * 新しいフォルダを作成します。
 *
 * @param {string} sessionToken セッショントークン
 * @param {string} name フォルダ名
 * @param {string} parentFolderId 親フォルダID。空ならルート
 * @return {{success: boolean, folder: Object}} 作成結果
 */
function createDriveFolder(sessionToken, name, parentFolderId) {
  requireSession_(sessionToken);

  const folderName = validateDriveItemName_(name);
  const parent = getAccessibleFolder_(parentFolderId);
  const folder = parent.createFolder(folderName);

  return {
    success: true,
    folder: getFolderView_(folder)
  };
}

/**
 * Base64形式で送信されたファイルをGoogle Driveへアップロードします。
 *
 * @param {string} sessionToken セッショントークン
 * @param {Object} uploadData アップロード情報
 * @return {{success: boolean, file: Object}} アップロード結果
 */
function uploadDriveFile(sessionToken, uploadData) {
  requireSession_(sessionToken);

  if (!uploadData || typeof uploadData !== 'object') {
    throw new Error('アップロードデータが正しくありません。');
  }

  const fileName = validateDriveItemName_(uploadData.name);
  const mimeType = String(uploadData.mimeType || 'application/octet-stream');
  const base64Data = String(uploadData.base64 || '');

  if (!base64Data) {
    throw new Error('アップロードするファイルを選択してください。');
  }

  const bytes = Utilities.base64Decode(base64Data);

  if (bytes.length > FILE_MANAGER_CONFIG.MAX_UPLOAD_BYTES) {
    throw new Error('アップロードできるファイルサイズは20MBまでです。');
  }

  const parent = getAccessibleFolder_(uploadData.parentFolderId);
  const blob = Utilities.newBlob(bytes, mimeType, fileName);
  const file = parent.createFile(blob);

  return {
    success: true,
    file: getFileView_(file)
  };
}

/**
 * DriveXルートフォルダ配下のファイル・フォルダを検索します。
 *
 * @param {string} sessionToken セッショントークン
 * @param {string} keyword 検索キーワード
 * @return {Object[]} 検索結果
 */
function searchDriveItems(sessionToken, keyword) {
  requireSession_(sessionToken);

  const query = String(keyword || '').trim();

  if (!query) {
    return [];
  }

  if (query.length > 100) {
    throw new Error('検索キーワードは100文字以下で入力してください。');
  }

  const escapedQuery = query.replace(/"/g, '\\"');
  const iterator = DriveApp.searchFiles(
    'trashed = false and title contains "' + escapedQuery + '"'
  );

  const results = [];

  while (iterator.hasNext() && results.length < FILE_MANAGER_CONFIG.MAX_SEARCH_RESULTS) {
    const file = iterator.next();

    if (isResourceInDriveXRoot_(file.getId())) {
      results.push(getFileView_(file));
    }
  }

  return results.sort(sortByName_);
}

/**
 * ファイルのプレビュー情報を取得します。
 *
 * @param {string} sessionToken セッショントークン
 * @param {string} fileId ファイルID
 * @return {Object} プレビュー情報
 */
function getDriveFilePreview(sessionToken, fileId) {
  requireSession_(sessionToken);

  const file = getAccessibleFile_(fileId);

  return {
    id: file.getId(),
    name: file.getName(),
    mimeType: file.getMimeType(),
    size: file.getSize(),
    updatedAt: file.getLastUpdated(),
    viewUrl: 'https://drive.google.com/file/d/' + file.getId() + '/preview',
    openUrl: file.getUrl()
  };
}

/**
 * ファイルをブラウザ側でダウンロードできるBase64形式で返します。
 * 20MBを超えるファイルはGoogle Driveの画面からダウンロードしてください。
 *
 * @param {string} sessionToken セッショントークン
 * @param {string} fileId ファイルID
 * @return {Object} ダウンロード情報
 */
function downloadDriveFile(sessionToken, fileId) {
  requireSession_(sessionToken);

  const file = getAccessibleFile_(fileId);

  if (file.getSize() > FILE_MANAGER_CONFIG.MAX_UPLOAD_BYTES) {
    throw new Error('20MBを超えるファイルはGoogle Driveの画面からダウンロードしてください。');
  }

  const blob = file.getBlob();

  return {
    id: file.getId(),
    name: file.getName(),
    mimeType: blob.getContentType(),
    base64: Utilities.base64Encode(blob.getBytes())
  };
}

/**
 * ファイルまたはフォルダをごみ箱へ移動します。
 *
 * @param {string} sessionToken セッショントークン
 * @param {string} itemId ファイルまたはフォルダID
 * @return {{success: boolean}} 実行結果
 */
function moveDriveItemToTrash(sessionToken, itemId) {
  const sessionUser = requireSession_(sessionToken);
  const normalizedItemId = validateDriveId_(itemId);

  const resource = getAccessibleResource_(normalizedItemId);
  resource.setTrashed(true);

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const user = findUserById_(sessionUser.data.UserId);
    let trashIds = parseStoredIdList_(user.data.TrashJson);

    trashIds.push(normalizedItemId);
    trashIds = Array.from(new Set(trashIds));

    updateUserFields_(user.rowNumber, {
      TrashJson: JSON.stringify(trashIds),
      UpdatedAt: new Date()
    });

    return {success: true};
  } finally {
    lock.releaseLock();
  }
}

/**
 * 自分がごみ箱へ移動した項目の一覧を取得します。
 *
 * @param {string} sessionToken セッショントークン
 * @return {Object[]} ごみ箱内の項目一覧
 */
function getMyTrashItems(sessionToken) {
  const user = requireSession_(sessionToken);
  const itemIds = parseStoredIdList_(user.data.TrashJson);
  const activeIds = [];
  const items = [];

  itemIds.forEach(function(itemId) {
    try {
      const resource = getDriveResourceById_(itemId);

      if (resource.isTrashed()) {
        activeIds.push(itemId);
        items.push(getResourceView_(resource));
      }
    } catch (error) {
      // Google Drive側で完全削除済みの項目は一覧から除外します。
    }
  });

  if (activeIds.length !== itemIds.length) {
    updateUserFields_(user.rowNumber, {
      TrashJson: JSON.stringify(activeIds),
      UpdatedAt: new Date()
    });
  }

  return items.sort(sortByName_);
}

/**
 * ごみ箱内のファイルまたはフォルダを復元します。
 *
 * @param {string} sessionToken セッショントークン
 * @param {string} itemId ファイルまたはフォルダID
 * @return {{success: boolean}} 実行結果
 */
function restoreDriveItemFromTrash(sessionToken, itemId) {
  const sessionUser = requireSession_(sessionToken);
  const normalizedItemId = validateDriveId_(itemId);

  const resource = getDriveResourceById_(normalizedItemId);

  if (!resource.isTrashed()) {
    throw new Error('この項目はごみ箱にありません。');
  }

  resource.setTrashed(false);

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const user = findUserById_(sessionUser.data.UserId);
    const trashIds = parseStoredIdList_(user.data.TrashJson)
      .filter(function(id) {
        return id !== normalizedItemId;
      });

    updateUserFields_(user.rowNumber, {
      TrashJson: JSON.stringify(trashIds),
      UpdatedAt: new Date()
    });

    return {success: true};
  } finally {
    lock.releaseLock();
  }
}

/**
 * Google Drive上のDriveXルートフォルダを取得します。
 * 初回のみ自動作成し、SettingsシートにIDを保存します。
 *
 * @return {GoogleAppsScript.Drive.Folder} ルートフォルダ
 */
function getDriveXRootFolder_() {
  const savedFolderId = getFileManagerSetting_(FILE_MANAGER_CONFIG.ROOT_FOLDER_SETTING);

  if (savedFolderId) {
    try {
      return DriveApp.getFolderById(savedFolderId);
    } catch (error) {
      // 設定済みフォルダが削除されている場合は新規作成します。
    }
  }

  const folder = DriveApp.createFolder(FILE_MANAGER_CONFIG.ROOT_FOLDER_NAME);
  setFileManagerSetting_(FILE_MANAGER_CONFIG.ROOT_FOLDER_SETTING, folder.getId());

  return folder;
}

/**
 * 指定フォルダがDriveXルート配下にあることを確認して返します。
 *
 * @param {string} folderId フォルダID
 * @return {GoogleAppsScript.Drive.Folder} フォルダ
 */
function getAccessibleFolder_(folderId) {
  const rootFolder = getDriveXRootFolder_();
  const targetFolderId = String(folderId || '').trim();

  if (!targetFolderId) {
    return rootFolder;
  }

  const folder = DriveApp.getFolderById(validateDriveId_(targetFolderId));

  if (!isResourceInDriveXRoot_(folder.getId())) {
    throw new Error('DriveXの管理対象外フォルダにはアクセスできません。');
  }

  return folder;
}

/**
 * 指定ファイルがDriveXルート配下にあることを確認して返します。
 *
 * @param {string} fileId ファイルID
 * @return {GoogleAppsScript.Drive.File} ファイル
 */
function getAccessibleFile_(fileId) {
  const file = DriveApp.getFileById(validateDriveId_(fileId));

  if (!isResourceInDriveXRoot_(file.getId())) {
    throw new Error('DriveXの管理対象外ファイルにはアクセスできません。');
  }

  return file;
}

/**
 * ファイル・フォルダいずれかを取得します。
 *
 * @param {string} itemId 項目ID
 * @return {GoogleAppsScript.Drive.File|GoogleAppsScript.Drive.Folder} リソース
 */
function getAccessibleResource_(itemId) {
  const resource = getDriveResourceById_(itemId);

  if (!isResourceInDriveXRoot_(itemId)) {
    throw new Error('DriveXの管理対象外項目にはアクセスできません。');
  }

  return resource;
}

/**
 * IDからファイルまたはフォルダを取得します。
 *
 * @param {string} itemId 項目ID
 * @return {GoogleAppsScript.Drive.File|GoogleAppsScript.Drive.Folder} リソース
 */
function getDriveResourceById_(itemId) {
  const normalizedItemId = validateDriveId_(itemId);

  try {
    return DriveApp.getFileById(normalizedItemId);
  } catch (fileError) {
    try {
      return DriveApp.getFolderById(normalizedItemId);
    } catch (folderError) {
      throw new Error('ファイルまたはフォルダが見つかりません。');
    }
  }
}

/**
 * リソースがDriveXルートフォルダ配下にあるか確認します。
 *
 * @param {string} itemId 項目ID
 * @return {boolean} ルート配下ならtrue
 */
function isResourceInDriveXRoot_(itemId) {
  const rootFolderId = getDriveXRootFolder_().getId();

  if (itemId === rootFolderId) {
    return true;
  }

  let resource;

  try {
    resource = getDriveResourceById_(itemId);
  } catch (error) {
    return false;
  }

  let parents = resource.getParents();
  let checkedCount = 0;

  while (parents.hasNext() && checkedCount < 100) {
    const parent = parents.next();

    if (parent.getId() === rootFolderId) {
      return true;
    }

    resource = parent;
    parents = resource.getParents();
    checkedCount++;
  }

  return false;
}

/**
 * ファイル情報を画面用の安全な形式へ変換します。
 *
 * @param {GoogleAppsScript.Drive.File} file ファイル
 * @return {Object} ファイル情報
 */
function getFileView_(file) {
  return {
    id: file.getId(),
    name: file.getName(),
    type: 'FILE',
    mimeType: file.getMimeType(),
    size: file.getSize(),
    createdAt: file.getDateCreated(),
    updatedAt: file.getLastUpdated(),
    url: file.getUrl()
  };
}

/**
 * フォルダ情報を画面用の形式へ変換します。
 *
 * @param {GoogleAppsScript.Drive.Folder} folder フォルダ
 * @return {Object} フォルダ情報
 */
function getFolderView_(folder) {
  return {
    id: folder.getId(),
    name: folder.getName(),
    type: 'FOLDER',
    mimeType: 'application/vnd.google-apps.folder',
    size: 0,
    createdAt: folder.getDateCreated(),
    updatedAt: folder.getLastUpdated(),
    url: folder.getUrl()
  };
}

/**
 * ファイルまたはフォルダを画面用の形式へ変換します。
 *
 * @param {Object} resource ファイルまたはフォルダ
 * @return {Object} 項目情報
 */
function getResourceView_(resource) {
  try {
    return getFileView_(resource);
  } catch (error) {
    return getFolderView_(resource);
  }
}

/**
 * 項目名を検証します。
 *
 * @param {string} name 項目名
 * @return {string} 検証済み項目名
 */
function validateDriveItemName_(name) {
  const itemName = String(name || '').trim();

  if (!itemName || itemName.length > 200) {
    throw new Error('名前は1文字以上200文字以下で入力してください。');
  }

  if (/[\r\n]/.test(itemName)) {
    throw new Error('名前に改行は使用できません。');
  }

  return itemName;
}

/**
 * Drive IDを検証します。
 *
 * @param {string} itemId Drive ID
 * @return {string} 検証済みID
 */
function validateDriveId_(itemId) {
  const id = String(itemId || '').trim();

  if (!/^[A-Za-z0-9_-]{10,}$/.test(id)) {
    throw new Error('ファイルIDが正しくありません。');
  }

  return id;
}

/**
 * 名前順ソート用関数です。
 *
 * @param {Object} first 1件目
 * @param {Object} second 2件目
 * @return {number} 比較結果
 */
function sortByName_(first, second) {
  return String(first.name).localeCompare(String(second.name), 'ja');
}

/**
 * Settingsシートから設定値を取得します。
 *
 * @param {string} key 設定キー
 * @return {string} 設定値
 */
function getFileManagerSetting_(key) {
  const values = getRequiredSheet_(AUTH_CONFIG.SETTINGS_SHEET)
    .getDataRange()
    .getValues();

  for (let rowIndex = 1; rowIndex < values.length; rowIndex++) {
    if (values[rowIndex][0] === key) {
      return String(values[rowIndex][1] || '');
    }
  }

  return '';
}

/**
 * Settingsシートへ設定値を保存します。
 *
 * @param {string} key 設定キー
 * @param {string} value 設定値
 */
function setFileManagerSetting_(key, value) {
  const sheet = getRequiredSheet_(AUTH_CONFIG.SETTINGS_SHEET);
  const values = sheet.getDataRange().getValues();

  for (let rowIndex = 1; rowIndex < values.length; rowIndex++) {
    if (values[rowIndex][0] === key) {
      sheet.getRange(rowIndex + 1, 2).setValue(value);
      sheet.getRange(rowIndex + 1, 3).setValue(new Date());
      return;
    }
  }

  sheet.appendRow([key, value, new Date()]);
}