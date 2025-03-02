/**
 * ReActエージェントアダプター実装
 * LangChain v0.3のReActフレームワークでツールアダプターを使用する
 */
import { AgentExecutor, createReactAgent } from "langchain/agents";
import { formatToOpenAITool } from "langchain/tools";
import { pull } from "langchain/hub";
import modelSelector from '../models/selector.js';
import Logger from '../utils/logger.js';
import config from '../config/index.js';
import { analysisTools } from '../tools/analysis-tools.js';
import ReActToolAdapter from '../tools/react-tool-adapter.js';
import { ChatPromptTemplate } from "@langchain/core/prompts";

/**
 * ReActフレームワークを使用したアダプター対応エージェントを設定するクラス
 */
class ReActAgentAdapter {
  /**
   * コンストラクタ
   * @param {Object} options - エージェント設定オプション
   * @param {string} options.modelName - 使用するモデル名
   * @param {Array} options.tools - 使用するツール配列
   * @param {number} options.maxIterations - 最大反復回数
   * @param {boolean} options.verbose - 詳細ログを出力するか
   */
  constructor(options = {}) {
    this.modelName = options.modelName || config.models.defaultModel;
    this.originalTools = options.tools || analysisTools;
    this.maxIterations = options.maxIterations || 10;
    this.verbose = options.verbose ?? true;
    this.agent = null;
    this.executor = null;
    
    // アダプターでラップされたツールを作成
    this.adaptedTools = ReActToolAdapter.wrapTools(this.originalTools);
    
    // エージェントの初期化状態
    this.initialized = false;
    
    Logger.info(`ReActエージェントアダプターを作成しました: モデル=${this.modelName}, ツール数=${this.originalTools.length}`, 'ReActAgentAdapter');
  }
  
  /**
   * エージェントを初期化する
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      Logger.info('ReActエージェントアダプターを初期化中...', 'ReActAgentAdapter');
      
      // モデルの取得
      this.llm = await modelSelector.getModel(this.modelName);
      
      Logger.info(`ReActエージェントアダプターを初期化します。`, 'ReActAgentAdapter');
      
      // ツール情報
      const toolNames = this.adaptedTools.map(t => t.name);
      Logger.info('ツール情報:', {
        toolsCount: this.adaptedTools.length,
        toolNames: toolNames
      }, 'ReActAgentAdapter');
      
      // カスタムプロンプトを作成（日本語優先設定）
      try {
        // 基本プロンプトをHubから取得
        let basePrompt = await pull("hwchase17/react");
        Logger.info("Hubからプロンプトを取得しました", "ReActAgentAdapter");
        
        // プロンプトテンプレートを取得
        let templateText = "";
        if (basePrompt.template) {
          templateText = basePrompt.template;
        } else if (basePrompt.messages && basePrompt.messages.length > 0) {
          // v0.3ではメッセージ配列を使用する場合がある
          const systemMessage = basePrompt.messages.find(m => m.role === 'system');
          if (systemMessage && systemMessage.content) {
            templateText = systemMessage.content;
          } else {
            templateText = basePrompt.messages[0].content;
          }
        } else {
          // フォールバック: 利用可能なプロパティを使用
          templateText = JSON.stringify(basePrompt);
          Logger.warn("プロンプトのテンプレートが見つかりません。フォールバックを使用します", "ReActAgentAdapter");
        }
        
        // 先頭に日本語指示を追加
        const customSystemPrompt = `
以下の質問に日本語で回答してください。複数のツールにアクセスできます。必要なツールのみを使用してください。
ツールの入力は常に日本語で行い、英語に翻訳しないでください。
日本語の入力をそのまま利用して処理を行ってください。

${templateText}
`;

        // カスタムプロンプトの作成
        const customPrompt = ChatPromptTemplate.fromMessages([
          ["system", customSystemPrompt]
        ]);
        
        Logger.info("カスタムプロンプト（日本語優先）を作成しました", "ReActAgentAdapter");
        
        // ReActエージェントの作成
        this.agent = await createReactAgent({
          llm: this.llm.model,
          tools: this.adaptedTools,
          prompt: customPrompt
        });
      } catch (promptError) {
        Logger.error(`Hubからのプロンプト取得に失敗: ${promptError.message}`, "ReActAgentAdapter");
        
        // デフォルトのReActエージェントを作成
        Logger.info("代替方法: LangChainのデフォルトReActプロンプトを使用します", "ReActAgentAdapter");
        
        this.agent = await createReactAgent({
          llm: this.llm.model,
          tools: this.adaptedTools
        });
      }
      
      // エージェント実行器の作成
      this.executor = new AgentExecutor({
        agent: this.agent,
        tools: this.adaptedTools,
        maxIterations: this.maxIterations,
        verbose: this.verbose,
        returnIntermediateSteps: true
      });
      
      this.initialized = true;
      Logger.info('ReActエージェントアダプターの初期化が完了しました', 'ReActAgentAdapter');
    } catch (error) {
      Logger.error(`ReActエージェントアダプターの初期化に失敗しました: ${error.message}`, 'ReActAgentAdapter');
      this.initialized = false;
      throw new Error(`エージェント初期化エラー: ${error.message}`);
    }
  }
  
  /**
   * モデルを変更する
   * @param {string} modelName - 新しいモデル名
   * @returns {Promise<boolean>} 成功したかどうか
   */
  async changeModel(modelName) {
    try {
      Logger.info(`モデルを ${this.modelName} から ${modelName} に変更します`, 'ReActAgentAdapter');
      
      // モデルの存在確認
      await modelSelector.getModel(modelName);
      
      // モデル名を更新
      this.modelName = modelName;
      
      // エージェントを再初期化
      this.initialized = false;
      await this.initialize();
      
      return true;
    } catch (error) {
      Logger.error(`モデル変更に失敗しました: ${error.message}`, 'ReActAgentAdapter');
      throw error;
    }
  }
  
  /**
   * エージェントに入力を実行させる
   * @param {string|Object} input - ユーザー入力またはオブジェクト
   * @returns {Promise<Object>} 実行結果
   */
  async run(input) {
    try {
      // 初期化されていない場合は初期化
      if (!this.initialized) {
        await this.initialize();
      }
      
      // 入力の処理
      let inputText;
      
      // inputがオブジェクトかどうかをチェック
      if (typeof input === 'object' && input !== null) {
        // inputオブジェクトからinputプロパティを取得
        inputText = input.input;
        
        // inputText が文字列でない場合は変換
        if (typeof inputText !== 'string') {
          Logger.warn(`入力プロパティが文字列ではありません。型: ${typeof inputText}、値: ${JSON.stringify(inputText)}`, 'ReActAgentAdapter');
          // オブジェクトの場合はJSON文字列に変換、それ以外の場合はString()を使用
          if (typeof inputText === 'object' && inputText !== null) {
            inputText = JSON.stringify(inputText);
          } else if (inputText === undefined || inputText === null) {
            inputText = '';
          } else {
            inputText = String(inputText);
          }
        }
      } else {
        // inputが文字列でない場合は変換
        if (typeof input !== 'string') {
          Logger.warn(`入力が文字列ではありません。型: ${typeof input}、値: ${JSON.stringify(input)}`, 'ReActAgentAdapter');
          // オブジェクトの場合はJSON文字列に変換、それ以外の場合はString()を使用
          if (typeof input === 'object' && input !== null) {
            inputText = JSON.stringify(input);
          } else if (input === undefined || input === null) {
            inputText = '';
          } else {
            inputText = String(input);
          }
        } else {
          inputText = input;
        }
      }
      
      // 入力が空の場合はデフォルトメッセージを設定
      if (!inputText || inputText.trim() === '') {
        inputText = 'こんにちは。何かお手伝いできることはありますか？';
        Logger.warn('空の入力を受け取りました。デフォルトメッセージに置き換えます', 'ReActAgentAdapter');
      }
      
      Logger.info(`エージェント実行開始: "${inputText.substring(0, 50)}${inputText.length > 50 ? '...' : ''}"`, 'ReActAgentAdapter');
      
      // エージェントの実行
      const result = await this.executor.invoke({
        input: inputText
      });
      
      Logger.info('エージェント実行完了', 'ReActAgentAdapter');
      
      return {
        output: result.output,
        intermediateSteps: result.intermediateSteps,
        modelName: this.modelName
      };
    } catch (error) {
      Logger.error(`エージェント実行エラー: ${error.message}`, 'ReActAgentAdapter');
      throw new Error(`実行エラー: ${error.message}`);
    }
  }
  
  /**
   * 利用可能なツール一覧を取得
   * @returns {Array} ツール一覧
   */
  getAvailableTools() {
    return this.originalTools.map(tool => ({
      name: tool.name,
      description: tool.description
    }));
  }
  
  /**
   * エージェントの現在の状態情報を取得
   * @returns {Object} 状態情報
   */
  getStatus() {
    return {
      initialized: this.initialized,
      modelName: this.modelName,
      modelDisplayName: config.models.getModelDisplayName(this.modelName),
      toolCount: this.originalTools.length,
      maxIterations: this.maxIterations
    };
  }
}

export default ReActAgentAdapter; 