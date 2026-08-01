/**
 * DriveX 共通処理
 * Webアプリの入口、画面表示、スプレッドシート接続を管理します。
 */

const DRIVEX_CONFIG = Object.freeze({
  APP_NAME: 'DriveX',
  SPREADSHEET_ID_KEY: 'DRIVEX_SPREADSHEET_ID',
  DEFAULT_PAGE: 'login',
  PAGES: Object.freeze({
    login: 'Login',
    dashboard: 'Dashboard'
  })
});

/**
 * Webアプリを開いた時に実行されます。
 *
 * @param {Object} e URLパラメータ
 * @return {GoogleAppsScript.HTML.HtmlOutput} 表示する画面
 */
function doGet(e) {
  const page = getPageName_(e);
  const template = HtmlService.createTemplateFromFile(DRIVEX_CONFIG.PAGES[page]);

  template.appName = DRIVEX_CONFIG.APP_NAME;
  template.webAppUrl = getWebAppUrl();
  template.currentPage = page;

  return template
    .evaluate()
    .setTitle(page === 'login' ? 'ログイン | DriveX' : DRIVEX_CONFIG.APP_NAME)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * 共通HTMLを読み込みます。
 *
 * @param {string} filename ファイル名
 * @return {string} HTML
 */
function include(filename) {
  const allowedFiles = ['Style', 'Script'];

  if (allowedFiles.indexOf(filename) === -1) {
    throw new Error('許可されていないHTMLファイルです。');
  }

  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * DriveX用スプレッドシートを初期登録します。
 * Auth.gs 作成後は、認証シートと初期管理者の作成も行います。
 *
 * @return {{success: boolean, message: string}} 実行結果
 */
function setupDriveX() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

  if (!spreadsheet) {
    throw new Error('DriveX用スプレッドシートに紐づくApps Scriptから実行してください。');
  }

  PropertiesService.getScriptProperties().setProperty(
    DRIVEX_CONFIG.SPREADSHEET_ID_KEY,
    spreadsheet.getId()
  );

  if (typeof initializeAuthentication_ === 'function') {
    initializeAuthentication_();

    return {
      success: true,
      message: 'DriveXの初期設定が完了しました。'
    };
  }

  return {
    success: true,
    message: 'スプレッドシートを登録しました。'
  };
}

/**
 * DriveX用スプレッドシートを取得します。
 *
 * @return {GoogleAppsScript.Spreadsheet.Spreadsheet} スプレッドシート
 */
function getDriveXSpreadsheet_() {
  const spreadsheetId = PropertiesService.getScriptProperties()
    .getProperty(DRIVEX_CONFIG.SPREADSHEET_ID_KEY);

  if (!spreadsheetId) {
    throw new Error('初期設定が未完了です。');
  }

  return SpreadsheetApp.openById(spreadsheetId);
}

/**
 * 必須シートを取得します。
 *
 * @param {string} sheetName シート名
 * @return {GoogleAppsScript.Spreadsheet.Sheet} シート
 */
function getRequiredSheet_(sheetName) {
  const sheet = getDriveXSpreadsheet_().getSheetByName(sheetName);

  if (!sheet) {
    throw new Error('シートが見つかりません: ' + sheetName);
  }

  return sheet;
}

/**
 * クライアントへ公開してよいアプリ情報を返します。
 *
 * @return {{appName: string, webAppUrl: string}} アプリ情報
 */
function getPublicAppConfig() {
  return {
    appName: DRIVEX_CONFIG.APP_NAME,
    webAppUrl: getWebAppUrl()
  };
}

/**
 * デプロイ済みWebアプリのURLを返します。
 *
 * @return {string} WebアプリURL
 */
function getWebAppUrl() {
  return ScriptApp.getService().getUrl() || '';
}

/**
 * URLパラメータから画面名を取得します。
 *
 * @param {Object} e URLパラメータ
 * @return {string} 画面名
 */
function getPageName_(e) {
  const page = String(
    (e && e.parameter && e.parameter.page) || DRIVEX_CONFIG.DEFAULT_PAGE
  ).trim().toLowerCase();

  if (Object.prototype.hasOwnProperty.call(DRIVEX_CONFIG.PAGES, page)) {
    return page;
  }

  return DRIVEX_CONFIG.DEFAULT_PAGE;
}