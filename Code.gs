/**
 * ==========================================================
 * DriveX - Code.gs
 * Webアプリ入口
 * Version : 1.0.1
 * ==========================================================
 */


/**
 * Webアプリ起動
 */
function doGet(e) {


  let page = "Login";


  if(
    e &&
    e.parameter &&
    e.parameter.page
  ){

    page =
      e.parameter.page;

  }



  return loadPage(
    page
  );


}



/**
 * HTMLページ読み込み
 */
function loadPage(
  page
) {


  const allowPages = [


    "Login",

    "Dashboard",

    "UserManager",

    "Upload",

    "Preview",

    "Settings"


  ];



  if(
    allowPages.indexOf(page)
    === -1
  ){

    page =
      "Login";

  }



  return HtmlService

    .createTemplateFromFile(
      page
    )

    .evaluate()

    .setTitle(
      DRIVEX.APP.NAME
    )

    .setXFrameOptionsMode(
      HtmlService
      .XFrameOptionsMode
      .ALLOWALL
    );


}



/**
 * HTML共通読み込み
 */
function include(
  filename
){

  return HtmlService

    .createHtmlOutputFromFile(
      filename
    )

    .getContent();

}



/**
 * ログイン情報取得
 */
function getLoginData(){

  return getLoginUserInfo();

}



/**
 * ログアウト
 */
function logoutUser(){


  const user =
    getCurrentUser();



  if(user){


    logLogout(
      user.userId
    );


  }



  return logout();


}



/**
 * WebアプリURL取得
 */
function getWebAppUrl(){


  return ScriptApp

    .getService()

    .getUrl();


}