/**
 * ReActエージェントのエントリポイント
 */
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import cli from './cli/index.js';
import Logger from './utils/logger.js';

// ES Modulesでのディレクトリパスの取得
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../');

// 環境変数の読み込み
dotenv.config({ path: path.join(rootDir, '.env') });

// アプリケーション起動ロギング
Logger.info('アプリケーションを起動しました', 'Main');

// 未処理の例外をキャッチ
process.on('uncaughtException', (error) => {
  Logger.error(`未処理の例外: ${error.message}`, 'Main');
  console.error('未処理の例外が発生しました。詳細はログを確認してください。');
  process.exit(1);
});

// 未処理のPromiseエラーをキャッチ
process.on('unhandledRejection', (reason, promise) => {
  Logger.error(`未処理のPromise拒否: ${reason}`, 'Main');
  console.error('未処理のPromise拒否が発生しました。詳細はログを確認してください。');
});

// CLIの実行
try {
  // コマンドライン引数がない場合はインタラクティブモードを起動
  if (process.argv.length <= 2) {
    cli.parse(['node', 'react-agent', 'interactive']);
  } else {
    cli.parse(process.argv);
  }
} catch (error) {
  Logger.error(`CLIエラー: ${error.message}`, 'Main');
  console.error(`エラーが発生しました: ${error.message}`);
  process.exit(1);
} 