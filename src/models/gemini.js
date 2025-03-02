/**
 * Geminiモデル実装
 */
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import config from '../config/index.js';
import Logger from '../utils/logger.js';

// デフォルトのLangChainパラメータ
const DEFAULT_PARAMS = {
  temperature: 0.7,
  maxOutputTokens: 1024,
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
 * Geminiモデルクラス
 */
class GeminiModel {
  constructor(modelName, options = {}) {
    this.modelName = modelName;
    this.modelConfig = config.models.availableModels[modelName];
    
    if (!this.modelConfig || this.modelConfig.provider !== 'gemini') {
      throw new Error(`無効なGeminiモデル: ${modelName}`);
    }
    
    // APIキーの取得
    const apiKey = config.apiKeys.gemini;
    if (!apiKey) {
      throw new Error('Gemini APIキーが設定されていません');
    }
    
    // パラメータの設定
    this.params = {
      ...DEFAULT_PARAMS,
      ...this.modelConfig.options,
      ...options,
      modelName: this.modelConfig.options.model,
      apiKey: apiKey,
      callbacks: [LoggingCallbacks.handlers]
    };
    
    Logger.info(`Geminiモデル "${modelName}" を設定しました`, 'GeminiModel');
    
    // LangChain ChatGoogleGenerativeAIの初期化
    this.model = new ChatGoogleGenerativeAI(this.params);
  }
  
  /**
   * チャットメッセージを送信し、応答を取得
   * @param {Array} messages - メッセージの配列
   * @returns {Promise<Object>} モデルからの応答
   */
  async chat(messages) {
    try {
      Logger.info(`"${this.modelName}" にメッセージを送信します`, 'GeminiModel');
      
      // HTTP通信リクエストのログ記録
      Logger.logHttpRequest({
        url: `https://generativelanguage.googleapis.com/v1beta/models/${this.params.modelName}:generateContent`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.params.apiKey}`
        },
        data: {
          contents: messages.map(m => ({
            role: m.role === 'user' ? 'user' : 'model', 
            parts: [{ text: m.content }]
          })),
          generationConfig: {
            temperature: this.params.temperature,
            maxOutputTokens: this.params.maxOutputTokens
          }
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
      Logger.error(`チャットエラー: ${error.message}`, 'GeminiModel');
      
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
      provider: 'gemini',
      model: this.params.modelName,
      temperature: this.params.temperature,
      maxOutputTokens: this.params.maxOutputTokens
    };
  }
}

export default GeminiModel; 