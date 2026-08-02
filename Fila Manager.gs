/**
 * ==========================================================
 * DriveX - FileManager.gs
 * ファイル管理
 * Version : 1.0.0
 * ==========================================================
 */


/**
 * Filesシート取得
 */
function getFileSheet() {


  const ss =
    SpreadsheetApp
      .getActiveSpreadsheet();



  const sheet =
    ss.getSheetByName(
      DRIVEX.SHEETS.FILES
    );



  if (
    !sheet
  ) {


    throw new Error(
      "Filesシートがありません。"
    );


  }



  return sheet;


}



/**
 * ユーザーのファイル一覧取得
 */
function getFileList(
  userId
) {


  const sheet =
    getFileSheet();



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
    .filter(function(row){


      return (
        row[1] === userId
      );


    })
    .map(function(row){


      return {


        fileId:
          row[0],


        userId:
          row[1],


        name:
          row[2],


        type:
          row[3],


        size:
          row[4],


        created:
          row[5]


      };


    });


}



/**
 * ファイル情報保存
 */
function saveFileInfo(
  data
) {


  const sheet =
    getFileSheet();



  sheet.appendRow([


    data.fileId,


    data.userId,


    data.name,


    data.type,


    data.size,


    getNow()


  ]);



  return true;


}



/**
 * Driveファイル取得
 */
function getDriveFile(
  fileId
) {


  return DriveApp
    .getFileById(
      fileId
    );


}
/**
 * ファイル移動（ゴミ箱）
 */
function moveToTrash(
  fileId,
  userId
) {


  const file =
    getDriveFile(
      fileId
    );



  const trashFolder =
    getTrashFolder();



  file.moveTo(
    trashFolder
  );



  const sheet =
    SpreadsheetApp
      .getActiveSpreadsheet()
      .getSheetByName(
        DRIVEX.SHEETS.TRASH
      );



  sheet.appendRow([


    fileId,


    userId,


    getNow()


  ]);



  return success(
    "ゴミ箱へ移動しました。"
  );


}



/**
 * ゴミ箱から復元
 */
function restoreFile(
  fileId
) {


  const file =
    getDriveFile(
      fileId
    );



  const filesFolder =
    getFilesFolder();



  file.moveTo(
    filesFolder
  );



  return success(
    "復元しました。"
  );


}



/**
 * 完全削除
 */
function deleteFile(
  fileId
) {


  const file =
    getDriveFile(
      fileId
    );



  file.setTrashed(
    true
  );



  return success(
    "削除しました。"
  );


}



/**
 * ファイル情報検索
 */
function getFileInfo(
  fileId
) {


  const sheet =
    getFileSheet();



  const values =
    sheet
      .getDataRange()
      .getValues();



  for (
    let i = 1;
    i < values.length;
    i++
  ) {


    if (
      values[i][0] === fileId
    ) {


      return {


        fileId:
          values[i][0],


        userId:
          values[i][1],


        name:
          values[i][2],


        type:
          values[i][3],


        size:
          values[i][4],


        created:
          values[i][5]


      };


    }


  }



  return null;


}
/**
 * お気に入り追加
 */
function addFavorite(
  userId,
  fileId
) {


  const sheet =
    SpreadsheetApp
      .getActiveSpreadsheet()
      .getSheetByName(
        DRIVEX.SHEETS.FAVORITES
      );



  sheet.appendRow([


    userId,


    fileId,


    getNow()


  ]);



  return success(
    "お気に入りに追加しました。"
  );


}



/**
 * お気に入り削除
 */
function removeFavorite(
  userId,
  fileId
) {


  const sheet =
    SpreadsheetApp
      .getActiveSpreadsheet()
      .getSheetByName(
        DRIVEX.SHEETS.FAVORITES
      );



  const values =
    sheet
      .getDataRange()
      .getValues();



  for (
    let i = 1;
    i < values.length;
    i++
  ) {


    if (
      values[i][0] === userId &&
      values[i][1] === fileId
    ) {


      sheet.deleteRow(
        i + 1
      );


      return success(
        "お気に入りを解除しました。"
      );


    }


  }



  return failure(
    "お気に入りが見つかりません。"
  );


}



/**
 * ファイル検索
 */
function searchFiles(
  userId,
  keyword
) {


  const files =
    getFileList(
      userId
    );



  keyword =
    toText(
      keyword
    )
    .toLowerCase();



  return files.filter(function(file){


    return (
      file.name
        .toLowerCase()
        .indexOf(
          keyword
        ) !== -1
    );


  });


}



/**
 * ファイル数取得
 */
function getFileCount(
  userId
) {


  return getFileList(
    userId
  ).length;


}