/**
 * モデルセレクタ
 * 使用するAIモデルを選択・切り替えるためのモジュール
 */
import config, { hasValidApiKey } from '../config/index.js';
import Logger from '../utils/logger.js';

// モデルのプロバイダごとのインポート
// 実際のインスタンス化は必要になった時点で行う（遅延初期化）
const modelProviders = {
  openai: async () => {
    const { default: OpenAIModel } = await import('./openai.js');
    return OpenAIModel;
  },
  anthropic: async () => {
    const { default: ClaudeModel } = await import('./claude.js');
    return ClaudeModel;
  },
  gemini: async () => {
    const { default: GeminiModel } = await import('./gemini.js');
    return GeminiModel;
  },
  deepseek: async () => {
    const { default: DeepSeekModel } = await import('./deepseek.js');
    return DeepSeekModel;
  }
};

class ModelSelector {
  constructor() {
    this.currentModelName = config.models.defaultModel;
    this.modelInstances = new Map();
    this.Logger = Logger;
  }

  /**
   * 現在選択されているモデル名を取得
   * @returns {string} 現在のモデル名
   */
  getCurrentModelName() {
    return this.currentModelName;
  }

  /**
   * 現在選択されているモデルの表示名を取得
   * @returns {string} 現在のモデルの表示名
   */
  getCurrentModelDisplayName() {
    return config.models.getModelDisplayName(this.currentModelName);
  }

  /**
   * 現在選択されているモデルのインスタンスを取得
   * @returns {Promise<Object>} モデルインスタンス
   */
  async getCurrentModel() {
    return this.getModel(this.currentModelName);
  }

  /**
   * 指定したモデルのインスタンスを取得
   * @param {string} modelName - モデル名
   * @returns {Promise<Object>} モデルインスタンス
   * @throws {Error} 無効なモデルが指定された場合
   */
  async getModel(modelName) {
    if (!config.models.isValidModel(modelName)) {
      throw new Error(`無効なモデル名です: ${modelName}`);
    }

    // すでにインスタンス化されている場合はそれを返す
    if (this.modelInstances.has(modelName)) {
      return this.modelInstances.get(modelName);
    }

    const providerName = config.models.getModelProvider(modelName);
    const modelOptions = config.models.availableModels[modelName].options;

    // APIキーが設定されているか確認
    if (!hasValidApiKey(providerName)) {
      throw new Error(`${providerName}のAPIキーが設定されていません。`);
    }

    try {
      // プロバイダのクラスを動的に読み込み
      const ModelClass = await modelProviders[providerName]();
      
      // モデルインスタンスを作成
      const modelInstance = new ModelClass(modelName, modelOptions);
      
      // キャッシュに保存
      this.modelInstances.set(modelName, modelInstance);
      
      this.Logger.info(`モデル "${modelName}" を初期化しました`, 'ModelSelector');
      return modelInstance;
    } catch (error) {
      this.Logger.error(`モデル "${modelName}" の初期化に失敗しました: ${error.message}`, 'ModelSelector');
      throw new Error(`モデル初期化エラー: ${error.message}`);
    }
  }

  /**
   * 現在のモデルを変更する
   * @param {string} modelName - 新しいモデル名
   * @returns {Promise<boolean>} 成功したか
   * @throws {Error} 無効なモデルが指定された場合
   */
  async setCurrentModel(modelName) {
    if (!config.models.isValidModel(modelName)) {
      throw new Error(`無効なモデル名です: ${modelName}`);
    }

    try {
      // モデルが利用可能か確認（初期化）
      await this.getModel(modelName);
      
      const oldModel = this.currentModelName;
      this.currentModelName = modelName;
      
      this.Logger.info(`モデルを "${oldModel}" から "${modelName}" に変更しました`, 'ModelSelector');
      return true;
    } catch (error) {
      this.Logger.error(`モデル "${modelName}" への変更に失敗しました: ${error.message}`, 'ModelSelector');
      throw error;
    }
  }

  /**
   * 利用可能なモデル一覧を取得
   * @returns {Array<string>} 利用可能なモデル名のリスト
   */
  getAvailableModels() {
    return Object.keys(config.models.availableModels);
  }

  /**
   * 特定のプロバイダーの利用可能なモデル一覧を取得
   * @param {string} provider - プロバイダー名
   * @returns {Array<string>} 利用可能なモデル名のリスト
   */
  getAvailableModelsByProvider(provider) {
    return Object.entries(config.models.availableModels)
      .filter(([_, model]) => model.provider === provider)
      .map(([name, _]) => name);
  }

  /**
   * モデルの詳細情報を取得
   * @param {string} modelName - モデル名
   * @returns {Object|null} モデル情報またはnull
   */
  getModelInfo(modelName) {
    if (!config.models.isValidModel(modelName)) {
      return null;
    }

    const modelData = config.models.availableModels[modelName];
    const provider = config.models.modelProviders[modelData.provider];
    
    return {
      name: modelName,
      provider: modelData.provider,
      providerName: provider,
      options: { ...modelData.options }
    };
  }
}

// シングルトンインスタンスを作成してエクスポート
const modelSelector = new ModelSelector();
export default modelSelector; 