/**
 * ReActエージェント実装
 * LangChain v0.3のReActフレームワークを使用
 */
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { RunnablePassthrough } from "@langchain/core/runnables";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { AgentExecutor, createReactAgent } from "langchain/agents";
import { formatToOpenAITool } from "langchain/tools";
import { pull } from "langchain/hub";
import modelSelector from '../models/selector.js';
import Logger from '../utils/logger.js';
import config from '../config/index.js';
import { analysisTools } from '../tools/analysis-tools.js';
import { SystemMessage, HumanMessage, AIMessage } from "@langchain/core/messages";

/**
 * ReActフレームワークを使用したエージェントを設定するクラス
 */
class ReActAgent {
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
    this.tools = options.tools || analysisTools;
    this.maxIterations = options.maxIterations || 10;
    this.verbose = options.verbose ?? true;
    this.agent = null;
    this.executor = null;
    
    // ツールをLangChain形式に変換
    this.formattedTools = this.tools.map(tool => formatToOpenAITool(tool));
    
    // エージェントの初期化状態
    this.initialized = false;
    
    Logger.info(`ReActエージェントを作成しました: モデル=${this.modelName}, ツール数=${this.tools.length}`, 'ReActAgent');
  }
  
  /**
   * エージェントを初期化する
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      Logger.info('ReActエージェントを初期化中...', 'ReActAgent');
      
      // モデルの取得
      this.llm = await modelSelector.getModel(this.modelName);
      
      Logger.info(`ReActエージェントを初期化します。`, 'ReActAgent');
      
      // ツール情報
      const toolNames = this.tools.map(t => t.name);
      console.log('ツール情報:', {
        toolsCount: this.tools.length,
        toolNames: toolNames
      });
      
      // カスタムプロンプトの作成
      // エラー時もReActフォーマットを維持するための特別な指示を追加
      const customSystemPrompt = `You are an AI assistant that helps with tasks using your tools.
When you encounter an error or problem with a tool, maintain the ReAct format:
1. Always use "Thought", "Action", "Action Input", and "Observation" in your responses.
2. If a tool fails, use Thought to explain the error, then try an alternative approach or provide feedback.
3. Never respond with direct error messages without the proper format.
4. Final answers should be prefixed with "Final Answer:".

Example of handling errors:
Thought: I attempted to use the save_document tool but encountered an error.
Action: I need to try a different approach.
Action Input: (alternative approach or parameters)
Observation: (result of the alternative approach)
Thought: Based on the observation, I can now...

Never break out of the ReAct format, even when reporting errors or issues.`;

      try {
        // Hubからデフォルトのプロンプトを取得して拡張する
        const prompt = await pull("hwchase17/react");
        
        // カスタムのシステムメッセージでプロンプトを拡張
        const customPrompt = prompt.copy();
        customPrompt.messages[0].content = customSystemPrompt + "\n\n" + customPrompt.messages[0].content;
        
        Logger.info("Hubからプロンプトを取得し、カスタマイズしました", "ReActAgent");
        
        // ReActエージェントの作成
        this.agent = await createReactAgent({
          llm: this.llm.model,
          tools: this.tools,
          prompt: customPrompt
        });
      } catch (promptError) {
        Logger.error(`Hubからのプロンプト取得に失敗: ${promptError.message}`, "ReActAgent");
        
        // FORMAT_INSTRUCTIONSからプロンプトを構築する代替方法
        Logger.info("代替方法: LangChainのデフォルトReActプロンプトを使用します", "ReActAgent");
        
        // カスタムプロンプトオブジェクトを作成
        const messages = [
          new SystemMessage(customSystemPrompt),
          new HumanMessage("{{input}}\n\nTools:\n{{tools}}\n\n{{agent_scratchpad}}")
        ];
        const customPromptTemplate = ChatPromptTemplate.fromMessages(messages);
        
        // デフォルトのReActエージェントを作成（カスタムプロンプト付き）
        this.agent = await createReactAgent({
          llm: this.llm.model,
          tools: this.tools,
          prompt: customPromptTemplate
        });
      }
      
      // エージェント実行器の作成
      this.executor = new AgentExecutor({
        agent: this.agent,
        tools: this.tools,
        maxIterations: this.maxIterations,
        verbose: this.verbose,
        returnIntermediateSteps: true
      });
      
      this.initialized = true;
      Logger.info('ReActエージェントの初期化が完了しました', 'ReActAgent');
    } catch (error) {
      Logger.error(`ReActエージェントの初期化に失敗しました: ${error.message}`, 'ReActAgent');
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
      Logger.info(`モデルを ${this.modelName} から ${modelName} に変更します`, 'ReActAgent');
      
      // モデルの存在確認
      await modelSelector.getModel(modelName);
      
      // モデル名を更新
      this.modelName = modelName;
      
      // エージェントを再初期化
      this.initialized = false;
      await this.initialize();
      
      return true;
    } catch (error) {
      Logger.error(`モデル変更に失敗しました: ${error.message}`, 'ReActAgent');
      throw error;
    }
  }
  
  /**
   * エージェントに入力を実行させる
   * @param {string} input - ユーザー入力
   * @returns {Promise<Object>} 実行結果
   */
  async run(input) {
    try {
      // 初期化されていない場合は初期化
      if (!this.initialized) {
        await this.initialize();
      }
      
      Logger.info(`エージェント実行開始: "${input.substring(0, 50)}${input.length > 50 ? '...' : ''}"`, 'ReActAgent');
      
      // エージェントの実行
      const result = await this.executor.invoke({
        input: input
      });
      
      Logger.info('エージェント実行完了', 'ReActAgent');
      
      return {
        output: result.output,
        intermediateSteps: result.intermediateSteps,
        modelName: this.modelName
      };
    } catch (error) {
      Logger.error(`エージェント実行エラー: ${error.message}`, 'ReActAgent');
      throw new Error(`実行エラー: ${error.message}`);
    }
  }
  
  /**
   * 利用可能なツール一覧を取得
   * @returns {Array} ツール一覧
   */
  getAvailableTools() {
    return this.tools.map(tool => ({
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
      toolCount: this.tools.length,
      maxIterations: this.maxIterations
    };
  }
}

export default ReActAgent; 