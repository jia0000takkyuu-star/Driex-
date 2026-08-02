/**
 * ==========================================================
 * DriveX - Files.gs
 * Google Drive ファイル管理
 * Version : 2.0.0
 * ==========================================================
 */

/**
 * ログインユーザーのルートフォルダ取得
 */
function getUserDriveFolder() {

  const user =
    getCurrentUser();

  if (!user) {

    throw new Error(
      "ログインしていません。"
    );

  }

  const usersFolder =
    getUsersFolder();

  const folders =
    usersFolder.getFoldersByName(
      user.userId
    );

  if (!folders.hasNext()) {

    throw new Error(
      "ユーザーフォルダがありません。"
    );

  }

  return folders.next();

}


/**
 * フォルダ一覧取得
 */
function getFolderList(folder) {

  const folders =
    folder.getFolders();

  const list = [];

  while (folders.hasNext()) {

    const item =
      folders.next();

    list.push({

      id:
        item.getId(),

      name:
        item.getName(),

      type:
        "folder",

      icon:
        "📁",

      updated:
        item.getLastUpdated()

    });

  }

  return list;

}


/**
 * MIMEタイプからアイコン取得
 */
function getFileIcon(mimeType) {

  if (!mimeType) {

    return "📄";

  }

  if (
    mimeType.indexOf("image/") === 0
  ) {

    return "🖼";

  }

  if (
    mimeType.indexOf("video/") === 0
  ) {

    return "🎥";

  }

  if (
    mimeType.indexOf("audio/") === 0
  ) {

    return "🎵";

  }

  if (
    mimeType === MimeType.PDF
  ) {

    return "📕";

  }

  if (
    mimeType.indexOf("spreadsheet") !== -1 ||
    mimeType.indexOf("excel") !== -1
  ) {

    return "📊";

  }

  if (
    mimeType.indexOf("document") !== -1 ||
    mimeType.indexOf("word") !== -1
  ) {

    return "📘";

  }

  if (
    mimeType.indexOf("presentation") !== -1 ||
    mimeType.indexOf("powerpoint") !== -1
  ) {

    return "📽";

  }

  if (
    mimeType.indexOf("zip") !== -1 ||
    mimeType.indexOf("compressed") !== -1
  ) {

    return "🗜";

  }

  return "📄";

}