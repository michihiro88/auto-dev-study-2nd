/**
 * OpenAIモデル実装
 */
import { ChatOpenAI } from "@langchain/openai";
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
 * OpenAIモデルクラス
 */
class OpenAIModel {
  constructor(modelName, options = {}) {
    this.modelName = modelName;
    this.modelConfig = config.models.availableModels[modelName];
    
    if (!this.modelConfig || this.modelConfig.provider !== 'openai') {
      throw new Error(`無効なOpenAIモデル: ${modelName}`);
    }
    
    // APIキーの取得
    const apiKey = config.apiKeys.openai;
    if (!apiKey) {
      throw new Error('OpenAI APIキーが設定されていません');
    }
    
    try {
      // LangChain v0.3.17のChatOpenAIの初期化方法を修正
      // Azure関連のパラメータをすべて除外し、明示的にOpenAI APIを使用することを指定
      this.model = new ChatOpenAI({
        temperature: this.modelConfig.options.temperature || DEFAULT_PARAMS.temperature,
        maxTokens: this.modelConfig.options.maxTokens || DEFAULT_PARAMS.maxTokens,
        modelName: this.modelConfig.options.model,
        openAIApiKey: apiKey,
        configuration: {
          baseURL: "https://api.openai.com/v1",
          apiKey: apiKey,
        },
        callbacks: [LoggingCallbacks.handlers]
      });

      Logger.info(`OpenAIモデル "${modelName}" を設定しました`, 'OpenAIModel');
    } catch (error) {
      Logger.error(`OpenAIモデルの初期化エラー: ${error.message}`, 'OpenAIModel');
      throw error;
    }
  }
  
  /**
   * チャットメッセージを送信し、応答を取得
   * @param {Array} messages - メッセージの配列
   * @returns {Promise<Object>} モデルからの応答
   */
  async chat(messages) {
    try {
      Logger.info(`"${this.modelName}" にメッセージを送信します`, 'OpenAIModel');
      
      // HTTP通信リクエストのログ記録
      Logger.logHttpRequest({
        url: 'https://api.openai.com/v1/chat/completions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKeys.openai}`
        },
        data: {
          model: this.modelConfig.options.model,
          messages: messages.map(m => ({
            role: m.role, 
            content: m.content
          })),
          temperature: this.modelConfig.options.temperature || DEFAULT_PARAMS.temperature,
          max_tokens: this.modelConfig.options.maxTokens || DEFAULT_PARAMS.maxTokens
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
      Logger.error(`チャットエラー: ${error.message}`, 'OpenAIModel');
      
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
      provider: 'openai',
      model: this.modelConfig.options.model,
      temperature: this.modelConfig.options.temperature || DEFAULT_PARAMS.temperature,
      maxTokens: this.modelConfig.options.maxTokens || DEFAULT_PARAMS.maxTokens
    };
  }
}

export default OpenAIModel; 