/**
 * ==========================================================
 * DriveX - Config.gs
 * システム設定
 * Version : 1.0.0
 * ==========================================================
 */


const DRIVEX = Object.freeze({


  /**
   * アプリ基本情報
   */
  APP: {

    NAME: "DriveX",

    VERSION: "1.0.0",

    TIMEZONE: "Asia/Tokyo"

  },


  /**
   * スプレッドシート
   */
  SHEETS: {

    USERS: "Users",

    FILES: "Files",

    FAVORITES: "Favorites",

    TRASH: "Trash",

    LOGS: "Logs",

    SETTINGS: "Settings"

  },


  /**
   * Driveフォルダー
   */
  FOLDERS: {

    ROOT: "DriveX",

    USERS: "Users",

    FILES: "Files",

    TRASH: "Trash",

    TEMP: "Temp",

    SYSTEM: "System"

  },


  /**
   * ユーザー設定
   */
  USER: {

    ROLES: {

      ADMIN: "admin",

      USER: "user"

    },


    STATUS: {

      ACTIVE: "active",

      INACTIVE: "inactive"

    }

  },


  /**
   * 初期管理者
   */
  ADMIN: {

    ID: "Driexadmin002",

    PASSWORD: "Driexpas002",

    ROLE: "admin"

  },


  /**
   * 初期ユーザー
   */
  DEFAULT_USER: {

    ID: "kari01",

    PASSWORD: "kari01",

    ROLE: "user"

  },


  /**
   * ファイル設定
   */
  FILE: {

    MAX_SIZE:
      100 * 1024 * 1024,


    ALLOW_EXTENSIONS: [

      "pdf",

      "png",
      "jpg",
      "jpeg",
      "gif",
      "webp",

      "mp4",
      "mov",

      "zip",

      "xls",
      "xlsx",

      "doc",
      "docx",

      "txt",

      "html",
      "css",
      "js",
      "gs"

    ]

  },


  /**
   * ログ設定
   */
  LOG: {

    ENABLE: true,

    LOGIN: true,

    ACTION: true

  },


  /**
   * 表示設定
   */
  VIEW: {

    DEFAULT_PAGE: "home",

    ITEMS_PER_PAGE: 50,

    MODE: "grid"

  },


  /**
   * セッション設定
   */
  SESSION: {

    TIMEOUT:

      60 * 60,


    KEY:

      "DRIVEX_SESSION"

  },


  /**
   * メッセージ
   */
  MESSAGE: {

    LOGIN_SUCCESS:

      "ログインしました。",


    LOGIN_FAILED:

      "ログイン情報が正しくありません。",


    PERMISSION_DENIED:

      "権限がありません。",


    USER_NOT_FOUND:

      "ユーザーが見つかりません。"

  },


  /**
   * システム設定
   */
  SYSTEM: {

    DEBUG: true,

    MAINTENANCE: false

  }


});