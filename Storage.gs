/**
 * ==========================================================
 * DriveX - Storage.gs
 * Google Drive管理
 * Version : 1.0.0
 * ==========================================================
 */


/**
 * DriveXルートフォルダー取得
 */
function getRootFolder() {

  const folders = DriveApp.getFoldersByName(
    DRIVEX.FOLDERS.ROOT
  );


  if (!folders.hasNext()) {

    throw new Error(
      "DriveXフォルダーが見つかりません。"
    );

  }


  return folders.next();

}


/**
 * 指定フォルダー取得
 */
function getStorageFolder(folderName) {

  const root =
    getRootFolder();


  const folders =
    root.getFoldersByName(
      folderName
    );


  if (!folders.hasNext()) {

    throw new Error(
      folderName +
      " フォルダーが見つかりません。"
    );

  }


  return folders.next();

}


/**
 * Usersフォルダー取得
 */
function getUsersFolder() {

  return getStorageFolder(
    DRIVEX.FOLDERS.USERS
  );

}


/**
 * Filesフォルダー取得
 */
function getFilesFolder() {

  return getStorageFolder(
    DRIVEX.FOLDERS.FILES
  );

}


/**
 * Trashフォルダー取得
 */
function getTrashFolder() {

  return getStorageFolder(
    DRIVEX.FOLDERS.TRASH
  );

}


/**
 * Tempフォルダー取得
 */
function getTempFolder() {

  return getStorageFolder(
    DRIVEX.FOLDERS.TEMP
  );

}


/**
 * Systemフォルダー取得
 */
function getSystemFolder() {

  return getStorageFolder(
    DRIVEX.FOLDERS.SYSTEM
  );

}
/**
 * フォルダー存在確認
 */
function storageFolderExists(folderName) {

  const root =
    getRootFolder();


  const folders =
    root.getFoldersByName(
      folderName
    );


  return folders.hasNext();

}


/**
 * DriveX基本フォルダー作成
 */
function setupStorageFolders() {

  const rootFolders =
    DriveApp.getFoldersByName(
      DRIVEX.FOLDERS.ROOT
    );


  let root;


  if (rootFolders.hasNext()) {

    root = rootFolders.next();

  } else {

    root =
      DriveApp.createFolder(
        DRIVEX.FOLDERS.ROOT
      );

  }


  const folders = [

    DRIVEX.FOLDERS.USERS,

    DRIVEX.FOLDERS.FILES,

    DRIVEX.FOLDERS.TRASH,

    DRIVEX.FOLDERS.TEMP,

    DRIVEX.FOLDERS.SYSTEM

  ];


  folders.forEach(function(name){

    const exists =
      root.getFoldersByName(name);


    if (!exists.hasNext()) {

      root.createFolder(name);

    }

  });


  return {
    success: true,
    message: "DriveXフォルダー構成を確認しました。"
  };

}


/**
 * ユーザーフォルダー作成
 */
function createUserFolder(userId) {


  const usersFolder =
    getUsersFolder();


  const folders =
    usersFolder.getFoldersByName(
      userId
    );


  if (folders.hasNext()) {

    return folders.next();

  }


  return usersFolder.createFolder(
    userId
  );

}


/**
 * ユーザーフォルダー取得
 */
function getUserFolder(userId) {


  const usersFolder =
    getUsersFolder();


  const folders =
    usersFolder.getFoldersByName(
      userId
    );


  if (!folders.hasNext()) {

    throw new Error(
      "ユーザーフォルダーが見つかりません。"
    );

  }


  return folders.next();

}


/**
 * ファイル移動
 */
function moveFileToFolder(fileId, folder) {


  const file =
    DriveApp.getFileById(
      fileId
    );


  file.moveTo(
    folder
  );


  return true;

}