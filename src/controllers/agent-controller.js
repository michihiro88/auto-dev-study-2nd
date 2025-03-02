/**
 * エージェントコントローラー
 * ReActエージェントを管理するためのコントローラー
 */
import path from 'path';
import fs from 'fs-extra';
import ReActAgentAdapter from '../agents/react-agent-adapter.js';
import modelSelector from '../models/selector.js';
import config from '../config/index.js';
import Logger from '../utils/logger.js';
import { getFormattedDateTime, getTimestampedFilename } from '../utils/formatter.js';

class AgentController {
  constructor() {
    // エージェントの作成
    this.agent = new ReActAgentAdapter();
    this.initialized = false;
    this.activeSession = null;
    this.sessionHistory = [];
    
    // 出力ディレクトリはconfig/index.jsで作成済み
    Logger.info('エージェントコントローラーを初期化しました', 'AgentController');
  }
  
  /**
   * コントローラーの初期化
   * @returns {Promise<boolean>} 初期化成功フラグ
   */
  async initialize() {
    try {
      Logger.info('エージェントコントローラーの初期化を開始します', 'AgentController');
      
      // モデルセレクタの利用可能なモデルを確認
      const availableModels = modelSelector.getAvailableModels();
      
      // エージェントの初期化
      await this.agent.initialize();
      
      // アクティブなセッションを作成
      this.createSession();
      
      this.initialized = true;
      Logger.info('エージェントコントローラーの初期化が完了しました', 'AgentController');
      return true;
    } catch (error) {
      Logger.error(`エージェントコントローラーの初期化に失敗しました: ${error.message}`, 'AgentController');
      this.initialized = false;
      throw error;
    }
  }
  
  /**
   * 新しいセッションを作成
   * @param {string} name - セッション名
   * @returns {Object} 新しいセッション
   */
  createSession(name = '') {
    // セッション名が指定されていない場合は日時を使用
    const sessionName = name || `Session_${getFormattedDateTime()}`;
    
    // 既存のセッションがあれば保存
    if (this.activeSession) {
      this.sessionHistory.push(this.activeSession);
    }
    
    // 新しいセッションの作成
    this.activeSession = {
      id: Date.now().toString(),
      name: sessionName,
      startTime: new Date(),
      messages: [],
      modelName: this.agent.modelName
    };
    
    Logger.info(`新しいセッションを作成しました: ${sessionName}`, 'AgentController');
    return this.activeSession;
  }
  
  /**
   * モデルを変更する
   * @param {string} modelName - 新しいモデル名
   * @returns {Promise<boolean>} 成功したかどうか
   */
  async changeModel(modelName) {
    try {
      // 初期化されていない場合は初期化
      if (!this.initialized) {
        await this.initialize();
      }
      
      Logger.info(`モデルを ${this.agent.modelName} から ${modelName} に変更します`, 'AgentController');
      
      // エージェントのモデルを変更
      await this.agent.changeModel(modelName);
      
      // セッションのモデル名を更新
      if (this.activeSession) {
        this.activeSession.modelName = modelName;
      }
      
      return true;
    } catch (error) {
      Logger.error(`モデル変更に失敗しました: ${error.message}`, 'AgentController');
      throw error;
    }
  }
  
  /**
   * エージェントに入力を処理させる
   * @param {string} input - ユーザー入力
   * @param {Object} options - 追加オプション
   * @returns {Promise<Object>} 処理結果
   */
  async processInput(input, options = {}) {
    try {
      // 初期化されていない場合は初期化
      if (!this.initialized) {
        await this.initialize();
      }
      
      // 入力が文字列でない場合は文字列に変換
      if (typeof input !== 'string') {
        Logger.warn(`入力が文字列ではありません。型: ${typeof input}、値: ${JSON.stringify(input)}`, 'AgentController');
        // オブジェクトの場合はJSON文字列に変換、それ以外の場合はString()を使用
        if (typeof input === 'object') {
          input = JSON.stringify(input);
        } else {
          input = String(input);
        }
      }
      
      Logger.info(`入力を処理します: "${input.substring(0, 50)}${input.length > 50 ? '...' : ''}"`, 'AgentController');
      
      // ユーザー入力をセッションに追加
      this.activeSession.messages.push({
        role: 'user',
        content: input,
        timestamp: new Date()
      });
      
      // エージェントによる入力の処理
      const result = await this.agent.run({
        input: input
      });
      
      // エージェントの応答をセッションに追加
      this.activeSession.messages.push({
        role: 'assistant',
        content: result.output,
        steps: result.intermediateSteps,
        timestamp: new Date()
      });
      
      Logger.info('入力の処理が完了しました', 'AgentController');
      
      return {
        output: result.output,
        intermediateSteps: result.intermediateSteps,
        sessionId: this.activeSession.id
      };
    } catch (error) {
      Logger.error(`入力処理エラー: ${error.message}`, 'AgentController');
      
      // エラーをセッションに追加
      this.activeSession.messages.push({
        role: 'error',
        content: error.message,
        timestamp: new Date()
      });
      
      throw error;
    }
  }
  
  /**
   * 現在のセッションを保存する
   * @param {string} folder - 保存先フォルダ名（outputDirsのプロパティ名）
   * @returns {Promise<string>} 保存先ファイルパス
   */
  async saveSession(folder = 'sessions') {
    try {
      if (!this.activeSession) {
        throw new Error('保存可能なアクティブセッションがありません');
      }
      
      // 保存用フォルダパスを取得（設定から）
      const outputDir = config.app.outputDirs[folder] || config.app.outputDirs.sessions;
      
      // セッションファイル名
      const filename = getTimestampedFilename(
        `session_${this.activeSession.name.replace(/\s+/g, '_')}`,
        'json'
      );
      
      const filePath = path.join(outputDir, filename);
      
      // セッションデータの作成
      const sessionData = {
        ...this.activeSession,
        endTime: new Date(),
        duration: (new Date() - this.activeSession.startTime) / 1000
      };
      
      // ディレクトリが存在しない場合は作成
      await fs.ensureDir(outputDir);
      Logger.info(`出力ディレクトリを確認: ${outputDir}`, 'AgentController');
      
      // ファイルへの保存
      await fs.writeJson(filePath, sessionData, { spaces: 2 });
      
      Logger.info(`セッションを保存しました: ${filePath}`, 'AgentController');
      
      return filePath;
    } catch (error) {
      Logger.error(`セッション保存エラー: ${error.message}`, 'AgentController');
      throw error;
    }
  }
  
  /**
   * 現在のエージェント状態を取得
   * @returns {Object} 状態情報
   */
  getStatus() {
    return {
      initialized: this.initialized,
      agentStatus: this.agent.getStatus(),
      hasActiveSession: !!this.activeSession,
      sessionCount: this.sessionHistory.length + (this.activeSession ? 1 : 0)
    };
  }
  
  /**
   * 利用可能なモデル一覧を取得
   * @returns {Array<string>} モデル名リスト
   */
  getAvailableModels() {
    return modelSelector.getAvailableModels();
  }
  
  /**
   * 現在のモデル情報を取得
   * @returns {Object} モデル情報
   */
  getCurrentModelInfo() {
    const modelName = this.agent.modelName;
    return {
      name: modelName,
      displayName: config.models.getModelDisplayName(modelName),
      ...modelSelector.getModelInfo(modelName)
    };
  }
}

// シングルトンインスタンスを作成してエクスポート
const agentController = new AgentController();
export default agentController; 