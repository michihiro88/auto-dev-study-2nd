/**
 * DeepSeekモデル実装
 */
import { ChatOllama } from "@langchain/community/chat_models/ollama";
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
 * DeepSeekモデルクラス（APIとOllamaの両方を対応）
 */
class DeepSeekModel {
  constructor(modelName, options = {}) {
    this.modelName = modelName;
    this.modelConfig = config.models.availableModels[modelName];
    
    if (!this.modelConfig || this.modelConfig.provider !== 'deepseek') {
      throw new Error(`無効なDeepSeekモデル: ${modelName}`);
    }
    
    // 接続タイプの判定 (api または ollama)
    this.connectionType = this.modelConfig.options.connectionType || 'api';
    
    if (this.connectionType === 'api') {
      // APIキーの取得
      const apiKey = config.apiKeys.deepseek;
      if (!apiKey) {
        throw new Error('DeepSeek APIキーが設定されていません');
      }
      
      // パラメータの設定 (API接続用)
      this.params = {
        ...DEFAULT_PARAMS,
        ...this.modelConfig.options,
        ...options,
        modelName: this.modelConfig.options.model,
        apiKey: apiKey,
        callbacks: [LoggingCallbacks.handlers]
      };
      
      // LangChain ChatDeepSeekの初期化（ここではOpenAIを活用）
      // 現在のLangChain v0.3では専用のDeepSeekクラスが存在しない可能性があるため、
      // OpenAIクラスをベースにカスタマイズする
      this.model = new ChatOpenAI({
        ...this.params,
        openAIApiKey: apiKey,
        // DeepSeek API エンドポイントへの上書き
        configuration: {
          baseURL: "https://api.deepseek.com/v1",
        }
      });
    } else if (this.connectionType === 'ollama') {
      // Ollamaの接続情報を取得
      const ollamaBaseUrl = config.ollama?.baseUrl || 'http://localhost:11434';
      
      // パラメータの設定 (Ollama接続用)
      this.params = {
        ...DEFAULT_PARAMS,
        ...this.modelConfig.options,
        ...options,
        model: this.modelConfig.options.model,
        baseUrl: ollamaBaseUrl,
        callbacks: [LoggingCallbacks.handlers]
      };
      
      // LangChain ChatOllamaの初期化
      this.model = new ChatOllama(this.params);
    } else {
      throw new Error(`未対応の接続タイプ: ${this.connectionType}`);
    }
    
    Logger.info(`DeepSeekモデル "${modelName}" を設定しました (${this.connectionType}接続)`, 'DeepSeekModel');
  }
  
  /**
   * チャットメッセージを送信し、応答を取得
   * @param {Array} messages - メッセージの配列
   * @returns {Promise<Object>} モデルからの応答
   */
  async chat(messages) {
    try {
      Logger.info(`"${this.modelName}" にメッセージを送信します`, 'DeepSeekModel');
      
      // HTTP通信リクエストのログ記録
      if (this.connectionType === 'api') {
        // API接続の場合の通信ログ
        Logger.logHttpRequest({
          url: 'https://api.deepseek.com/v1/chat/completions',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.params.apiKey}`
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
      } else {
        // Ollama接続の場合の通信ログ
        Logger.logHttpRequest({
          url: `${this.params.baseUrl}/api/chat`,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          data: {
            model: this.params.model,
            messages: messages.map(m => ({
              role: m.role, 
              content: m.content
            })),
            temperature: this.params.temperature,
            max_tokens: this.params.maxTokens
          }
        });
      }
      
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
      Logger.error(`チャットエラー: ${error.message}`, 'DeepSeekModel');
      
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
      provider: 'deepseek',
      connectionType: this.connectionType,
      model: this.connectionType === 'api' ? this.params.modelName : this.params.model,
      temperature: this.params.temperature,
      maxTokens: this.params.maxTokens
    };
  }
}

export default DeepSeekModel; 