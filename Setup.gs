/**
 * ==========================================================
 * DriveX - Setup.gs
 * 初期セットアップ
 * Version : 1.0.0
 * ==========================================================
 */


/**
 * DriveX初期セットアップ
 */
function setupDriveX() {

  setupStorageFolders();

  setupSheets();

  setupDefaultUsers();


  return {
    success: true,
    message: "DriveX初期設定が完了しました。"
  };

}


/**
 * スプレッドシートシート作成
 */
function setupSheets() {


  const ss =
    SpreadsheetApp.getActiveSpreadsheet();


  const sheets = [

    DRIVEX.SHEETS.USERS,

    DRIVEX.SHEETS.FILES,

    DRIVEX.SHEETS.FAVORITES,

    DRIVEX.SHEETS.TRASH,

    DRIVEX.SHEETS.LOGS,

    DRIVEX.SHEETS.SETTINGS

  ];


  sheets.forEach(function(name){


    let sheet =
      ss.getSheetByName(name);


    if (!sheet) {


      sheet =
        ss.insertSheet(name);


      setupSheetHeader(
        sheet,
        name
      );


    }


  });


}


/**
 * シートヘッダー設定
 */
function setupSheetHeader(sheet, name) {


  const headers = {


    Users: [

      "UserID",

      "Password",

      "Role",

      "Status"

    ],


    Files: [

      "FileID",

      "UserID",

      "Name",

      "Type",

      "Size",

      "Created"

    ],


    Favorites: [

      "UserID",

      "FileID",

      "Created"

    ],


    Trash: [

      "FileID",

      "UserID",

      "Deleted"

    ],


    Logs: [

      "Time",

      "UserID",

      "Action",

      "Detail"

    ],


    Settings: [

      "Key",

      "Value"

    ]


  };


  if (headers[name]) {

    sheet
      .getRange(
        1,
        1,
        1,
        headers[name].length
      )
      .setValues([
        headers[name]
      ]);

  }


}
/**
 * 初期ユーザー作成
 */
function setupDefaultUsers() {


  const sheet =
    SpreadsheetApp
      .getActiveSpreadsheet()
      .getSheetByName(
        DRIVEX.SHEETS.USERS
      );


  const users =
    sheet
      .getDataRange()
      .getValues();


  const existingIds =
    users.map(function(row){

      return row[0];

    });


  /**
   * 管理者追加
   */
  if (
    existingIds.indexOf(
      DRIVEX.ADMIN.ID
    ) === -1
  ) {


    sheet.appendRow([

      DRIVEX.ADMIN.ID,

      DRIVEX.ADMIN.PASSWORD,

      DRIVEX.ADMIN.ROLE,

      DRIVEX.USER.STATUS.ACTIVE

    ]);


    createUserFolder(
      DRIVEX.ADMIN.ID
    );


  }


  /**
   * 初期一般ユーザー追加
   */
  if (
    existingIds.indexOf(
      DRIVEX.DEFAULT_USER.ID
    ) === -1
  ) {


    sheet.appendRow([

      DRIVEX.DEFAULT_USER.ID,

      DRIVEX.DEFAULT_USER.PASSWORD,

      DRIVEX.DEFAULT_USER.ROLE,

      DRIVEX.USER.STATUS.ACTIVE

    ]);


    createUserFolder(
      DRIVEX.DEFAULT_USER.ID
    );


  }


}


/**
 * セットアップ確認
 */
function checkDriveXSetup() {


  const result = {


    root:

      false,


    sheets:

      false,


    users:

      false


  };


  try {


    getRootFolder();


    result.root = true;


  } catch(e) {


    result.root = false;


  }



  const ss =
    SpreadsheetApp
      .getActiveSpreadsheet();


  result.sheets =

    ss.getSheetByName(
      DRIVEX.SHEETS.USERS
    ) !== null;



  const users =
    getUsersForSetup();


  result.users =
    users.length > 0;



  return result;


}


/**
 * セットアップ用ユーザー取得
 */
function getUsersForSetup() {


  const sheet =
    SpreadsheetApp
      .getActiveSpreadsheet()
      .getSheetByName(
        DRIVEX.SHEETS.USERS
      );


  if (!sheet) {

    return [];

  }


  const values =
    sheet
      .getDataRange()
      .getValues();


  if (values.length <= 1) {

    return [];

  }


  return values.slice(1);


}