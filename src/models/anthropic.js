/**
 * Anthropicモデル実装
 */
import { ChatAnthropic } from "@langchain/anthropic";
import config from '../config/index.js';
import Logger from '../utils/logger.js';

// デフォルトのLangChainパラメータ
const DEFAULT_PARAMS = {
  temperature: 0.7,
  maxTokens: 1024,
  verbose: true,  // LangChainの内部ログ出力を有効化
  streaming: false
};

// HTTP通信のロギング機能
class LoggingCallbacks {
  static handlers = {
    handleLLMStart: async (llm, prompts) => {
      Logger.logChatEvent('llm/start', { 
        name: llm.name, 
        input: { messages: prompts }
      });
    },
    handleLLMEnd: async (output) => {
      Logger.logChatEvent('llm/end', { output });
    },
    handleLLMError: async (error) => {
      Logger.logChatEvent('llm/error', { error: error.message });
    },
    handleChainStart: async (chain, inputs) => {
      Logger.logChatEvent('chain/start', { 
        name: chain.name, 
        input: inputs
      });
    },
    handleChainEnd: async (outputs) => {
      Logger.logChatEvent('chain/end', { outputs });
    },
    handleChainError: async (error) => {
      Logger.logChatEvent('chain/error', { error: error.message });
    },
    handleToolStart: async (tool, input) => {
      Logger.logChatEvent('tool/start', { 
        name: tool.name, 
        input
      });
    },
    handleToolEnd: async (output) => {
      Logger.logChatEvent('tool/end', { output });
    },
    handleToolError: async (error) => {
      Logger.logChatEvent('tool/error', { error: error.message });
    }
  };
}

/**
 * Anthropicモデルクラス
 */
class AnthropicModel {
  constructor(modelName, options = {}) {
    this.modelName = modelName;
    this.modelConfig = config.models.availableModels[modelName];
    
    if (!this.modelConfig || this.modelConfig.provider !== 'anthropic') {
      throw new Error(`無効なAnthropicモデル: ${modelName}`);
    }
    
    // APIキーの取得
    const apiKey = config.apiKeys.anthropic;
    if (!apiKey) {
      throw new Error('Anthropic APIキーが設定されていません');
    }
    
    // パラメータの設定
    this.params = {
      ...DEFAULT_PARAMS,
      ...this.modelConfig.options,
      ...options,
      modelName: this.modelConfig.options.model,
      anthropicApiKey: apiKey,
      callbacks: [LoggingCallbacks.handlers]
    };
    
    Logger.info(`Anthropicモデル "${modelName}" を設定しました`, 'AnthropicModel');
    
    // LangChain ChatAnthropicの初期化
    this.model = new ChatAnthropic(this.params);
  }
  
  /**
   * チャットメッセージを送信し、応答を取得
   * @param {Array} messages - メッセージの配列
   * @returns {Promise<Object>} モデルからの応答
   */
  async chat(messages) {
    try {
      Logger.info(`"${this.modelName}" にメッセージを送信します`, 'AnthropicModel');
      
      // HTTP通信リクエストのログ記録
      Logger.logHttpRequest({
        url: 'https://api.anthropic.com/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Anthropic-Version': '2023-06-01',
          'x-api-key': this.params.anthropicApiKey
        },
        data: {
          model: this.params.modelName,
          messages: messages.map(m => ({
            role: m.role, 
            content: m.content
          })),
          temperature: this.params.temperature,
          max_tokens: this.params.maxTokens
        }
      });
      
      // モデルに問い合わせ
      const response = await this.model.invoke(messages);
      
      // HTTP通信レスポンスのログ記録
      Logger.logHttpResponse({
        status: 200,
        data: {
          message: response
        }
      });
      
      return response;
    } catch (error) {
      Logger.error(`チャットエラー: ${error.message}`, 'AnthropicModel');
      
      // エラーレスポンスのログ記録
      Logger.logHttpResponse({
        status: error.status || 500,
        error: error.message
      });
      
      throw error;
    }
  }
  
  /**
   * テキスト生成
   * @param {string} prompt - 入力プロンプト
   * @returns {Promise<string>} 生成されたテキスト
   */
  async generate(prompt) {
    // Anthropicでは、humanメッセージとして扱う
    const messages = [{ role: 'user', content: prompt }];
    const response = await this.chat(messages);
    return response.content;
  }
  
  /**
   * モデル情報の取得
   * @returns {Object} モデル情報
   */
  getInfo() {
    return {
      name: this.modelName,
      provider: 'anthropic',
      model: this.params.modelName,
      temperature: this.params.temperature,
      maxTokens: this.params.maxTokens
    };
  }
}

export default AnthropicModel; 