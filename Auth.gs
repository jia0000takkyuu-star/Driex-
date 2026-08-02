/**
 * ==========================================================
 * DriveX - Auth.gs
 * 認証・セッション管理
 * Version : 1.0.0
 * ==========================================================
 */


/**
 * ログイン
 */
function login(
  userId,
  password
) {


  userId =
    toText(userId);


  password =
    toText(password);



  if (
    isEmpty(userId) ||
    isEmpty(password)
  ) {


    return failure(
      "IDまたはパスワードが入力されていません。"
    );


  }



  const user =
    getUser(
      userId
    );



  if (
    !user
  ) {


    return failure(
      DRIVEX.MESSAGE.LOGIN_FAILED
    );


  }



  if (
    user.password !== password
  ) {


    return failure(
      DRIVEX.MESSAGE.LOGIN_FAILED
    );


  }



  if (
    user.status !==
    DRIVEX.USER.STATUS.ACTIVE
  ) {


    return failure(
      "このユーザーは無効です。"
    );


  }



  const session =
    createSession(
      user
    );



  return success(
    DRIVEX.MESSAGE.LOGIN_SUCCESS,
    session
  );


}



/**
 * セッション作成
 */
function createSession(
  user
) {


  const session = {


    sessionId:

      generateId(
        "SESSION"
      ),


    userId:

      user.userId,


    role:

      user.role,


    loginTime:

      getNow()


  };



  PropertiesService
    .getUserProperties()
    .setProperty(
      DRIVEX.SESSION.KEY,
      toJson(session)
    );



  return session;


}



/**
 * 現在ログインユーザー取得
 */
function getCurrentUser() {


  const data =
    PropertiesService
      .getUserProperties()
      .getProperty(
        DRIVEX.SESSION.KEY
      );



  if (
    !data
  ) {

    return null;

  }



  return fromJson(
    data
  );


}
/**
 * ログアウト
 */
function logout() {


  PropertiesService
    .getUserProperties()
    .deleteProperty(
      DRIVEX.SESSION.KEY
    );


  return success(
    "ログアウトしました。"
  );


}



/**
 * ログイン状態確認
 */
function isLoggedIn() {


  const user =
    getCurrentUser();



  return user !== null;


}



/**
 * 権限取得
 */
function getCurrentRole() {


  const user =
    getCurrentUser();



  if (
    !user
  ) {

    return null;

  }



  return user.role;


}



/**
 * 管理者確認
 */
function requireAdmin() {


  const role =
    getCurrentRole();



  if (
    role !==
    DRIVEX.USER.ROLES.ADMIN
  ) {


    return false;


  }



  return true;


}



/**
 * ログインユーザー情報取得
 */
function getLoginUserInfo() {


  const session =
    getCurrentUser();



  if (
    !session
  ) {


    return failure(
      "ログインしていません。"
    );


  }



  const user =
    getUser(
      session.userId
    );



  if (
    !user
  ) {


    return failure(
      "ユーザー情報がありません。"
    );


  }



  return success(
    "取得しました。",
    {

      userId:
        user.userId,


      role:
        user.role,


      status:
        user.status

    }
  );


}