/**
 * アプリケーション設定
 */
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs-extra';

import * as modelConfig from './models.js';

// ES Modulesでのディレクトリパスおよびファイルパスの取得
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');

// 環境変数の読み込み
dotenv.config({ path: path.join(rootDir, '.env') });

// ログディレクトリの設定
const logDir = process.env.LOG_DIR || path.join(rootDir, 'logs');

// 出力ディレクトリの設定
const outputDir = process.env.OUTPUT_DIR || path.join(rootDir, 'output');

// 出力サブディレクトリの定義
const outputDirs = {
  root: outputDir,
  requirements: path.join(outputDir, 'requirements'),
  designs: path.join(outputDir, 'designs'),
  sessions: path.join(outputDir, 'sessions'),
  diagrams: path.join(outputDir, 'diagrams')
};

// 必要なディレクトリを作成
fs.ensureDirSync(logDir);
Object.values(outputDirs).forEach(dir => fs.ensureDirSync(dir));

// 設定オブジェクト
const config = {
  // アプリケーション情報
  app: {
    name: 'ReAct Agent',
    version: '1.0.0',
    rootDir,
    logDir,
    outputDir,
    outputDirs
  },

  // ログ設定
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    appLogFile: (date) => path.join(logDir, `app_${date.toISOString().split('T')[0].replace(/-/g, '')}.log`),
    httpLogFile: (date) => path.join(logDir, `http_${date.toISOString().split('T')[0].replace(/-/g, '')}.log`),
    chatLogFile: (date) => path.join(logDir, `chat_${date.toISOString().split('T')[0].replace(/-/g, '')}.log`)
  },

  // モデル設定
  models: {
    ...modelConfig,
    defaultModel: process.env.DEFAULT_MODEL || modelConfig.defaultModel
  },

  // API キー
  apiKeys: {
    openai: process.env.OPENAI_API_KEY,
    anthropic: process.env.ANTHROPIC_API_KEY,
    google: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    deepseek: process.env.DEEPSEEK_API_KEY
  }
};

/**
 * APIキーが設定されているかチェックする
 * @param {string} provider - プロバイダー名
 * @returns {boolean} APIキーが設定されているかどうか
 */
export const hasValidApiKey = (provider) => {
  const keyMapping = {
    openai: 'openai',
    anthropic: 'anthropic',
    gemini: 'google',
    deepseek: 'deepseek'
  };
  
  const keyName = keyMapping[provider];
  return Boolean(config.apiKeys[keyName]);
};

export default config; 