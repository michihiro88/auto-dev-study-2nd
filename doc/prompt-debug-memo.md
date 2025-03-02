# LangChain v0.3 ReActエージェント初期化の問題点と対応策

## 発生した問題

LangChain v0.3でReActエージェントを初期化する際に、以下のエラーが発生しました：

```
Provided prompt is missing required input variables: ["tools","tool_names"]
```

その後、修正を試みるも、別のエラーが発生：

```
Cannot read properties of undefined (reading 'inputVariables')
```

## 試行したアプローチ

### 1. システムプロンプトにツール情報を埋め込む方法

```javascript
// システムプロンプトに変数を含める
const systemPrompt = `あなたは要件分析と外部設計を専門とするReActエージェントです。

【利用可能なツール】
{tools}

【使用できるツール】
{tool_names}
`;

// ChatPromptTemplateを使用
const prompt = ChatPromptTemplate.fromMessages([
  ["system", systemPrompt],
  ["human", "{input}"],
  ["ai", "{agent_scratchpad}"]
]);

// partialメソッドで変数を埋め込み
const partialPrompt = prompt.partial({
  tools: toolsFormatted,
  tool_names: toolNamesFormatted
});

// エージェント作成
this.agent = await createReactAgent({
  llm: this.llm.model,
  tools: this.tools,
  prompt: partialPrompt
});
```

結果: `Provided prompt is missing required input variables: ["tools","tool_names"]`

### 2. メッセージオブジェクトを直接使用する方法

```javascript
// 直接メッセージオブジェクトを作成
const messages = [
  new SystemMessage(systemPrompt
    .replace("{tools}", toolsFormatted)
    .replace("{tool_names}", toolNamesFormatted)
  ),
  new HumanMessage("{input}"),
  new AIMessage("{agent_scratchpad}")
];

// カスタムプロンプトを作成（直接メッセージオブジェクトを使用）
const customPrompt = ChatPromptTemplate.fromMessages(messages);

// エージェント作成
this.agent = await createReactAgent({
  llm: this.llm.model,
  tools: this.tools,
  prompt: customPrompt
});
```

結果: `prompt is not defined` というエラー（ログ出力の変数を削除したため）

### 3. ChatPromptTemplate.fromTemplateを使用する方法

```javascript
// プロンプトテンプレートを直接構築
const prompt = ChatPromptTemplate.fromTemplate(systemPromptTemplate);

// 変数をバインド
const boundPrompt = prompt.partial({
  tools: toolsFormatted,
  tool_names: toolNamesFormatted
});

// エージェント作成
this.agent = await createReactAgent({
  llm: this.llm.model,
  tools: this.tools,
  prompt: boundPrompt
});
```

結果: `Cannot read properties of undefined (reading 'includes')`

### 4. デフォルトプロンプトを使用する方法

```javascript
// 最もシンプルな方法でReActエージェントを作成
this.agent = await createReactAgent({
  llm: this.llm.model,
  tools: this.tools
});
```

結果: `Cannot read properties of undefined (reading 'inputVariables')`

## 考察

1. LangChain v0.3の`createReactAgent`関数の仕様が以前のバージョンと異なっている可能性があります。

2. ドキュメントで示されているAPIと実際の実装に乖離がある可能性があります。

3. 内部でReActプロンプトを構築する際に、`tools`と`tool_names`変数がプロンプトに必要なのに、どのように提供すればよいかが明確でありません。

4. デフォルトプロンプトでさえエラーが発生することから、LangChain v0.3のバージョンやインストール方法に問題がある可能性があります。

## 推奨される対応策

1. LangChain v0.3の具体的なバージョンを確認し、最新バージョンにアップデートする。

2. LangChain GitHubリポジトリでReActエージェントの使用例や同様の問題の報告がないか確認する。

3. プロンプトテンプレートを使わずに、LangChain v0.3の別のエージェント実装（OpenAI Functionsエージェントなど）を試す。

4. LangChain v0.3の正確なドキュメントを参照し、ReActエージェントの正しい初期化方法を確認する。

## 実験に使ったコード

```javascript
// ReActエージェントを初期化する関数
async initialize() {
  try {
    Logger.info('ReActエージェントを初期化中...', 'ReActAgent');
    
    // モデルの取得
    this.llm = await modelSelector.getModel(this.modelName);
    
    Logger.info(`ReActエージェントを初期化します。`, 'ReActAgent');
    
    // ツール情報
    console.log('ツール情報:', {
      toolsCount: this.tools.length,
      toolNames: this.tools.map(t => t.name),
    });
    
    // 最もシンプルな方法でReActエージェントを作成
    this.agent = await createReactAgent({
      llm: this.llm.model,
      tools: this.tools,
    });
    
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