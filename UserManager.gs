/**
 * ==========================================================
 * DriveX - UserManager.gs
 * ユーザー管理
 * Version : 1.0.0
 * ==========================================================
 */


/**
 * Usersシート取得
 */
function getUserSheet() {

  const ss =
    SpreadsheetApp
      .getActiveSpreadsheet();


  const sheet =
    ss.getSheetByName(
      DRIVEX.SHEETS.USERS
    );


  if (!sheet) {

    throw new Error(
      "Usersシートがありません。"
    );

  }


  return sheet;

}


/**
 * ユーザー一覧取得
 */
function getUserList() {


  const sheet =
    getUserSheet();


  const values =
    sheet
      .getDataRange()
      .getValues();


  if (values.length <= 1) {

    return [];

  }


  return values
    .slice(1)
    .map(function(row){


      return {

        userId: row[0],

        password: row[1],

        role: row[2],

        status: row[3]

      };


    });


}


/**
 * ユーザー取得
 */
function getUser(userId) {


  const users =
    getUserList();


  for (
    let i = 0;
    i < users.length;
    i++
  ) {


    if (
      users[i].userId === userId
    ) {

      return users[i];

    }


  }


  return null;


}


/**
 * ユーザー存在確認
 */
function userExists(userId) {


  return (
    getUser(userId) !== null
  );


}


/**
 * ユーザー追加チェック
 */
function validateNewUser(
  userId,
  password
) {


  if (
    isEmpty(userId)
  ) {

    return failure(
      "ユーザーIDが空です。"
    );

  }


  if (
    isEmpty(password)
  ) {

    return failure(
      "パスワードが空です。"
    );

  }


  if (
    userExists(userId)
  ) {

    return failure(
      "このユーザーIDは既に存在します。"
    );

  }


  return success(
    "OK"
  );


}
/**
 * ユーザー追加
 */
function addUser(
  userId,
  password,
  role
) {


  const check =
    validateNewUser(
      userId,
      password
    );


  if (
    !check.success
  ) {

    return check;

  }


  role =
    role ||
    DRIVEX.USER.ROLES.USER;



  const sheet =
    getUserSheet();



  sheet.appendRow([

    userId,

    password,

    role,

    DRIVEX.USER.STATUS.ACTIVE

  ]);



  /**
   * ユーザーフォルダー作成
   */
  createUserFolder(
    userId
  );



  return success(
    "ユーザーを追加しました。",
    {
      userId: userId
    }
  );


}



/**
 * ユーザー削除
 */
function deleteUser(
  userId
) {


  const sheet =
    getUserSheet();


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
      values[i][0] === userId
    ) {


      sheet.deleteRow(
        i + 1
      );


      return success(
        "ユーザーを削除しました。"
      );


    }


  }



  return failure(
    "ユーザーが見つかりません。"
  );


}



/**
 * パスワード変更
 */
function changePassword(
  userId,
  newPassword
) {


  const sheet =
    getUserSheet();


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
      values[i][0] === userId
    ) {


      sheet
        .getRange(
          i + 1,
          2
        )
        .setValue(
          newPassword
        );


      return success(
        "パスワードを変更しました。"
      );


    }


  }



  return failure(
    "ユーザーが見つかりません。"
  );


}
/**
 * 権限変更
 */
function changeUserRole(
  userId,
  role
) {


  const sheet =
    getUserSheet();


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
      values[i][0] === userId
    ) {


      sheet
        .getRange(
          i + 1,
          3
        )
        .setValue(
          role
        );


      return success(
        "権限を変更しました。"
      );


    }


  }



  return failure(
    "ユーザーが見つかりません。"
  );


}



/**
 * ユーザー状態変更
 */
function changeUserStatus(
  userId,
  status
) {


  const sheet =
    getUserSheet();


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
      values[i][0] === userId
    ) {


      sheet
        .getRange(
          i + 1,
          4
        )
        .setValue(
          status
        );


      return success(
        "状態を変更しました。"
      );


    }


  }



  return failure(
    "ユーザーが見つかりません。"
  );


}



/**
 * ユーザー情報取得（管理画面用）
 */
function getUserDetail(
  userId
) {


  const user =
    getUser(
      userId
    );


  if (
    !user
  ) {

    return failure(
      "ユーザーが見つかりません。"
    );

  }


  return success(
    "取得しました。",
    user
  );


}



/**
 * 全ユーザー数取得
 */
function getUserCount() {


  const users =
    getUserList();


  return users.length;


}