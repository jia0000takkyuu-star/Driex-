/**
 * ==========================================================
 * DriveX - LogManager.gs
 * 操作ログ管理
 * Version : 1.0.0
 * ==========================================================
 */


/**
 * Logsシート取得
 */
function getLogSheet() {


  const ss =
    SpreadsheetApp
      .getActiveSpreadsheet();



  const sheet =
    ss.getSheetByName(
      DRIVEX.SHEETS.LOGS
    );



  if (!sheet) {

    throw new Error(
      "Logsシートがありません。"
    );

  }


  return sheet;

}



/**
 * ログ追加
 */
function addLog(
  userId,
  action,
  detail
) {


  if (
    !DRIVEX.LOG.ENABLE
  ) {

    return false;

  }



  const sheet =
    getLogSheet();



  sheet.appendRow([


    getNow(),


    userId || "",


    action || "",


    detail || ""


  ]);



  return true;

}



/**
 * ログインログ
 */
function logLogin(
  userId
) {


  return addLog(

    userId,

    "LOGIN",

    "ログインしました。"

  );


}



/**
 * ログアウトログ
 */
function logLogout(
  userId
) {


  return addLog(

    userId,

    "LOGOUT",

    "ログアウトしました。"

  );


}



/**
 * 操作ログ取得
 */
function getLogs() {


  const sheet =
    getLogSheet();



  const values =
    sheet
      .getDataRange()
      .getValues();



  if (
    values.length <= 1
  ) {

    return [];

  }



  return values
    .slice(1)
    .map(function(row){


      return {


        time:
          row[0],


        userId:
          row[1],


        action:
          row[2],


        detail:
          row[3]


      };


    });


}
/**
 * ユーザー別ログ取得
 */
function getUserLogs(
  userId
) {


  const logs =
    getLogs();



  return logs.filter(function(log){


    return (
      log.userId === userId
    );


  });


}



/**
 * 操作別ログ取得
 */
function getActionLogs(
  action
) {


  const logs =
    getLogs();



  return logs.filter(function(log){


    return (
      log.action === action
    );


  });


}



/**
 * 最新ログ取得
 */
function getLatestLogs(
  limit
) {


  const logs =
    getLogs();



  limit =
    limit ||
    50;



  return logs
    .slice(
      -limit
    )
    .reverse();


}



/**
 * ログ件数取得
 */
function getLogCount() {


  return getLogs()
    .length;


}