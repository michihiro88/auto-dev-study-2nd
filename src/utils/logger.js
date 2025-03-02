/**
 * ロガーユーティリティ
 * アプリケーションログ、通信ログ、チャットログを管理する
 */
import winston from 'winston';
import fs from 'fs-extra';
import config from '../config/index.js';

// ログレベル定義
const LOG_LEVELS = {
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  DEBUG: 'debug'
};

// マッピング（外部設定からWinstonのログレベルへ）
const LOG_LEVEL_MAP = {
  'ERR': LOG_LEVELS.ERROR,
  'WARN': LOG_LEVELS.WARN,
  'INFO': LOG_LEVELS.INFO,
  'DEBUG': LOG_LEVELS.DEBUG
};

// 現在の日付を取得
const getCurrentDate = () => new Date();

// フォーマッタ
const logFormat = winston.format.printf(({ level, message, timestamp, module }) => {
  return `[${timestamp}] [${level.toUpperCase()}] [${module || 'App'}] - ${message}`;
});

// ロガーの設定
const logger = winston.createLogger({
  level: config.logging.level,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'react-agent' },
  transports: [
    // コンソール出力
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.printf(info => {
          const { timestamp, level, message, module, ...rest } = info;
          const moduleStr = module ? `[${module}]` : '';
          const restStr = Object.keys(rest).length ? JSON.stringify(rest) : '';
          return `[${timestamp}] [${level}] ${moduleStr} - ${message} ${restStr}`;
        })
      )
    }),
    
    // ファイル出力を追加
    new winston.transports.File({
      filename: config.logging.appLogFile(new Date()),
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.printf(info => {
          const { timestamp, level, message, module, ...rest } = info;
          const moduleStr = module ? `[${module}]` : '';
          const restStr = Object.keys(rest).length ? JSON.stringify(rest) : '';
          return `[${timestamp}] [${level}] ${moduleStr} - ${message} ${restStr}`;
        })
      )
    })
  ]
});

// HTTP通信ロガー
const httpLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ 
      filename: config.logging.httpLogFile(getCurrentDate()) 
    })
  ]
});

// チャットロガー
const chatLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ 
      filename: config.logging.chatLogFile(getCurrentDate()) 
    })
  ]
});

/**
 * ロガークラス
 */
class Logger {
  /**
   * アプリケーションログを記録
   * @param {string} level - ログレベル ('info', 'warn', 'error')
   * @param {string} message - ログメッセージ
   * @param {string} module - モジュール名
   */
  static log(level, message, module = 'App') {
    const winstonLevel = LOG_LEVEL_MAP[level] || level;
    logger.log(winstonLevel, message, { module });
  }
  
  /**
   * 情報ログを記録
   * @param {string} message - ログメッセージ
   * @param {string} module - モジュール名
   */
  static info(message, module) {
    this.log(LOG_LEVELS.INFO, message, module);
  }
  
  /**
   * 警告ログを記録
   * @param {string} message - ログメッセージ
   * @param {string} module - モジュール名
   */
  static warn(message, module) {
    this.log(LOG_LEVELS.WARN, message, module);
  }
  
  /**
   * エラーログを記録
   * @param {string|Error} message - ログメッセージまたはエラーオブジェクト
   * @param {string} module - モジュール名
   */
  static error(message, module) {
    // Errorオブジェクトがそのまま渡された場合の処理
    if (message instanceof Error) {
      const errorObj = {
        message: message.message,
        name: message.name,
        stack: message.stack,
      };
      
      // スタックトレースをログに記録
      this.log(LOG_LEVELS.ERROR, `エラー: ${message.message}`, module);
      this.log(LOG_LEVELS.ERROR, `スタックトレース: ${message.stack || '利用不可'}`, module);
      
      // エラーに追加情報がある場合はそれも記録
      if (message.code) {
        this.log(LOG_LEVELS.ERROR, `エラーコード: ${message.code}`, module);
      }
      
      if (message.cause) {
        this.log(LOG_LEVELS.ERROR, `原因: ${message.cause instanceof Error ? message.cause.message : message.cause}`, module);
      }
      
      return;
    }
    
    // 通常の文字列メッセージの場合
    this.log(LOG_LEVELS.ERROR, message, module);
  }
  
  /**
   * デバッグログを記録
   * @param {string} message - ログメッセージ
   * @param {string} module - モジュール名
   */
  static debug(message, module) {
    this.log(LOG_LEVELS.DEBUG, message, module);
  }
  
  /**
   * HTTP通信ログを記録（リクエスト）
   * @param {Object} request - HTTPリクエスト情報
   */
  static logHttpRequest(request) {
    // 機密情報をマスク
    const maskedRequest = this._maskSensitiveInfo(request);
    httpLogger.info({ type: 'REQUEST', ...maskedRequest });
  }
  
  /**
   * HTTP通信ログを記録（レスポンス）
   * @param {Object} response - HTTPレスポンス情報
   */
  static logHttpResponse(response) {
    httpLogger.info({ type: 'RESPONSE', ...response });
  }
  
  /**
   * チャットイベントログを記録
   * @param {string} eventType - イベントタイプ (llm/start, llm/end, chain/start, chain/end, etc.)
   * @param {Object} content - イベント内容
   */
  static logChatEvent(eventType, content) {
    chatLogger.info({ event: eventType, ...content });
  }
  
  /**
   * 機密情報をマスクする
   * @param {Object} data - マスクするデータ
   * @returns {Object} マスクされたデータ
   * @private
   */
  static _maskSensitiveInfo(data) {
    if (!data) return data;
    
    const maskedData = JSON.parse(JSON.stringify(data));
    
    // APIキーをマスク
    if (maskedData.headers) {
      const sensitiveHeaders = ['authorization', 'x-api-key', 'api-key'];
      for (const header of sensitiveHeaders) {
        if (maskedData.headers[header]) {
          maskedData.headers[header] = '********';
        }
      }
    }
    
    return maskedData;
  }
  
  /**
   * ログファイルを更新（日付が変わった場合など）
   */
  static updateLogFiles() {
    const currentDate = getCurrentDate();
    
    // トランスポートを更新
    logger.transports.forEach(transport => {
      if (transport instanceof winston.transports.File) {
        transport.filename = config.logging.appLogFile(currentDate);
      }
    });
    
    httpLogger.transports.forEach(transport => {
      if (transport instanceof winston.transports.File) {
        transport.filename = config.logging.httpLogFile(currentDate);
      }
    });
    
    chatLogger.transports.forEach(transport => {
      if (transport instanceof winston.transports.File) {
        transport.filename = config.logging.chatLogFile(currentDate);
      }
    });
  }
}

export default Logger; 