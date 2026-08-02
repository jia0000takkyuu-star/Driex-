/**
 * ==========================================================
 * DriveX - Utils.gs
 * 共通処理
 * Version : 1.0.0
 * ==========================================================
 */


/**
 * 現在日時取得
 */
function getNow() {

  return Utilities.formatDate(
    new Date(),
    DRIVEX.APP.TIMEZONE,
    "yyyy/MM/dd HH:mm:ss"
  );

}


/**
 * 現在日付取得
 */
function getToday() {

  return Utilities.formatDate(
    new Date(),
    DRIVEX.APP.TIMEZONE,
    "yyyy/MM/dd"
  );

}


/**
 * ID生成
 */
function generateId(prefix) {

  const time =
    new Date().getTime();

  const random =
    Math.floor(Math.random() * 10000);

  return (
    prefix +
    "_" +
    time +
    "_" +
    random
  );

}


/**
 * 空チェック
 */
function isEmpty(value) {

  return (
    value === null ||
    value === undefined ||
    String(value).trim() === ""
  );

}


/**
 * 文字列化
 */
function toText(value) {

  if (value === null || value === undefined) {

    return "";

  }

  return String(value).trim();

}


/**
 * 配列チェック
 */
function isArray(value) {

  return Array.isArray(value);

}


/**
 * メール形式チェック
 */
function isEmail(email) {

  const regex =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  return regex.test(email);

}


/**
 * 管理者判定
 */
function isAdmin(role) {

  return (
    role === DRIVEX.USER.ROLES.ADMIN
  );

}


/**
 * 一般ユーザー判定
 */
function isUser(role) {

  return (
    role === DRIVEX.USER.ROLES.USER
  );

}


/**
 * 成功レスポンス
 */
function success(message, data) {

  return {

    success: true,

    message:
      message || "",

    data:
      data || null

  };

}


/**
 * 失敗レスポンス
 */
function failure(message) {

  return {

    success: false,

    message:
      message || "エラー"

  };

}


/**
 * JSON変換
 */
function toJson(data) {

  return JSON.stringify(data);

}


/**
 * JSON解析
 */
function fromJson(data) {

  try {

    return JSON.parse(data);

  } catch(e) {

    return null;

  }

}


/**
 * ログ出力
 */
function debugLog(message) {

  if (DRIVEX.SYSTEM.DEBUG) {

    console.log(
      "[" +
      getNow() +
      "] " +
      message
    );

  }

}