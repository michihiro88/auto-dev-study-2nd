# ReActエージェント バグレポートと解決策

## 概要

本ドキュメントはReActエージェント実装において発生した主なバグと、その解決策についてまとめたものです。LangChain v0.3からv0.4へのアップデートに伴い発生した互換性の問題や、APIの挙動変化による問題を中心に記録しています。

## バグ1：Azure OpenAI API関連のエラー

### 現象
```
[ERROR] [ModelSelector] - モデル "gpt-4o-mini" の初期化に失敗しました: Azure OpenAI API instance name not found
[ERROR] [ReActAgent] - ReActエージェントの初期化に失敗しました: モデル初期化エラー: Azure OpenAI API instance name not found
```

アプリケーションの起動時に、Azure OpenAI APIのインスタンス名が見つからないというエラーが発生し、エージェントの初期化に失敗する。

### 原因
- OpenAI社のAPIキーを使用しているにもかかわらず、LangChainが自動的にAzure OpenAI APIモードで接続しようとしていた
- LangChain v0.3.17の`@langchain/openai`パッケージにおいて、特定の条件下で自動的にAzure OpenAI APIモードに切り替わる機能がある
- モデル名`gpt-4o-mini`がAzureモードをトリガーしていた可能性

### 分析結果
- `ChatOpenAI`クラスは、内部的に接続先を判断するロジックを持っている
- 標準のOpenAI APIを使用するための設定が不足していた
- モデル設定と実際のAPIの不一致があった

### 対策内容
1. OpenAIモデルの初期化パラメータを修正：
```javascript
// OpenAI APIのエンドポイント設定を明示的に指定
this.params.configuration = {
  apiKey: apiKey,
  basePath: "https://api.openai.com/v1"
};

// azure関連のパラメータを明示的にnullに設定
this.params.azure = false;
this.params.azureOpenAIApiInstanceName = null;
this.params.azureOpenAIApiDeploymentName = null;
this.params.azureOpenAIApiVersion = null;
```

2. デフォルトモデルを変更：
```javascript
// models.jsファイルの修正
export const defaultModel = process.env.DEFAULT_MODEL || 'gpt-3.5-turbo';
```

3. READMEにトラブルシューティング情報を追加：
```
### Azure OpenAI API関連のエラーが発生する場合
エラーメッセージ「Azure OpenAI API instance name not found」が表示される場合：
- `.env`ファイルで`DEFAULT_MODEL`を`gpt-3.5-turbo`に設定してください
- このプロジェクトはAzure OpenAI Serviceではなく、OpenAI社が提供する標準APIを使用するように設計されています
```

4. パッケージをアップデート：
```json
"@langchain/openai": "^0.4.4"
```

## バグ2：プロンプトテンプレート変数エラー

### 現象
```
[ERROR] [ReActAgent] - ReActエージェントの初期化に失敗しました: Provided prompt is missing required input variables: ["tools","tool_names"]
```

エージェントの初期化時に、プロンプトに必要な変数が不足しているというエラーが発生。

### 原因
- LangChain v0.4.4の`createReactAgent`関数は、プロンプトテンプレート内に特定の名前の変数（`tools`と`tool_names`）が存在することを要求している
- プロンプトテンプレートの変数が正しく設定されていなかった
- テンプレート変数名と実際に提供する変数の不一致

### 分析結果
- LangChainの内部処理では、特定の名前の変数に対して特別な処理を行う
- JavaScriptの変数展開（`${変数}`）ではなく、LangChainの変数プレースホルダー（`{変数名}`）が必要
- プロンプト作成時だけでなく、実行時にも変数の値の提供が必要

### 対策内容
1. プロンプトテンプレートの修正：
```javascript
// 正しい変数プレースホルダーを使用
const systemPromptTemplate = `
...
あなたは以下のツールを使用できます:
{tools}

使用可能なツール名のリスト:
{tool_names}
...
`;
```

2. エージェント実行器の初期化時に変数を提供：
```javascript
this.executor = AgentExecutor.fromAgentAndTools({
  // ...その他のパラメータ...
  inputVariables: {
    tools: toolDescriptions,
    tool_names: toolNamesString
  }
});
```

3. 実行時にも変数を提供：
```javascript
const result = await this.executor.invoke({
  input: input,
  tools: toolDescriptions,
  tool_names: toolNamesString
});
```

## バグ3：メッセージコンテンツの型エラー

### 現象
```
[ERROR] [ReActAgent] - ReActエージェントの初期化に失敗しました: message.content.map is not a function
```

プロンプトテンプレート処理時に、LangChainの内部で`message.content.map`を呼び出そうとしてエラーが発生。

### 原因
- プロンプト処理方法に問題があり、`content`プロパティが文字列型になっていたが、LangChainは配列型を期待していた
- `ChatPromptTemplate.fromTemplate`と`partial`メソッドの使用方法に問題があった
- テンプレート処理の中間結果の型が期待と異なっていた

### 分析結果
- LangChainの内部処理で、特定の文脈では`content`は配列であることが期待されている
- テンプレート処理の方法によって、結果のメッセージオブジェクトの構造が変わる
- 複雑なテンプレート処理よりも、基本的な方法で一貫性を保つ方が安全

### 対策内容
1. テンプレート処理方法の簡素化：
```javascript
// シンプルな方法に変更
const chatPrompt = ChatPromptTemplate.fromMessages([
  ["system", systemPromptTemplate],  // 文字列の直接指定
  ["human", "{input}"],
  ["ai", "{agent_scratchpad}"],
]);
```

2. JavaScriptテンプレートリテラルを使った変数の直接埋め込みを避ける：
```javascript
// このようなコードは避ける
const systemPromptWithValues = `
...
あなたは以下のツールを使用できます:
${toolDescriptions}
...
`;
```

3. LangChainの変数命名規則と一致させる：
```javascript
// 変数名をLangChainの期待する名前と完全に一致させる
const result = await this.executor.invoke({
  input: input,
  tools: toolDescriptions,    // 名前が重要
  tool_names: toolNamesString // 名前が重要
});
```

## バグ4：Windows環境でのCLIインタラクション問題

### 現象
アプリケーションは正常に起動し、ReActエージェントも初期化されるものの、インタラクティブなCLIメニューでキー入力（矢印キーやEnterキーなど）が受け付けられず、操作ができない状態になる。見た目上はハングアップしているように見える。

### 原因
- `inquirer` ライブラリ（v9.x.x）がWindowsターミナル環境、特にPowerShellと互換性の問題を抱えている
- Node.jsのESModule環境（`"type": "module"`）と`inquirer`の組み合わせが問題を引き起こす
- Windowsでのターミナル入力処理やANSIエスケープシーケンスの処理方法の違い

### 分析結果
- `inquirer` v9.0.0以降はESModule形式のみをサポートしている
- Windows環境（特にPowerShell）でのインタラクティブな入力処理が正しく機能していない
- キー入力イベントのハンドリングがOS依存の挙動を示している

### 対策内容
1. `inquirer`を`prompts`ライブラリに置き換え
```javascript
// 変更前
import inquirer from 'inquirer';

// 変更後
import prompts from 'prompts';
```

2. package.jsonの依存関係更新：
```diff
- "inquirer": "^9.2.12",
+ "prompts": "^2.4.2",
```

3. プロンプト処理の書き換え：
```javascript
// 変更前
const { action } = await inquirer.prompt([
  {
    type: 'list',
    name: 'action',
    message: '操作を選択してください:',
    choices: [
      { name: '要件分析・外部設計を行う', value: 'analyze' },
      // ...
    ]
  }
]);

// 変更後
const response = await prompts({
  type: 'select',
  name: 'action',
  message: '操作を選択してください:',
  choices: [
    { title: '要件分析・外部設計を行う', value: 'analyze' },
    // ...
  ],
  initial: 0
}, {
  onCancel: () => {
    console.log(chalk.yellow('操作をキャンセルしました'));
    return { action: null };
  }
});

if (!response.action) continue;
```

4. ユーザー入力のキャンセル処理の追加：
```javascript
// キャンセル処理の実装
onCancel: () => {
  console.log(chalk.yellow('入力をキャンセルしました'));
  return { result: null };
}
```

## バグ5：出力ディレクトリ不足による分析結果保存エラー

### 現象
要件分析や外部設計を実行すると、コマンドラインインターフェイスでは正常に動作して結果が表示されるが、結果が`output/requirements/`や`output/designs/`ディレクトリに保存されない。

### 原因
- アプリケーション起動時に`output`ディレクトリは自動的に作成されるが、サブディレクトリ（`requirements`や`designs`）は自動作成されていなかった
- `src/tools/analysis-tools.js`内の各ツールは、`requirements`と`designs`のサブディレクトリが存在することを前提としていた
- コード内では`fs.ensureDirSync()`を使用してディレクトリの存在確認を行っているが、ディレクトリが存在しない場合に自動的に作成する処理がアプリ起動時に実行されていなかった

### 分析結果
- `agentController`コンストラクタでは`config.app.outputDir`のみが作成され、サブディレクトリは作成されていない
- 各ツールの`_call`メソッド内では対応するサブディレクトリを確認・作成する処理があるものの、実際の生成されたファイルがこのパスに保存される部分が実装されていない
- ツールの`_call`メソッドでは「この時点では分析結果はまだ生成されていないので、このツールからは入力を返すだけ」というコメントがあり、実際のファイル保存はエージェントから呼び出される必要がある

### 対策内容
1. 必要なサブディレクトリを手動で作成：
```powershell
mkdir output\requirements
mkdir output\designs
```

2. アプリケーション起動時にすべての必要なディレクトリを自動作成するよう修正：
```javascript
// src/controllers/agent-controller.js のコンストラクタ内に追加
constructor() {
  // ...既存コード...
  
  // 出力ディレクトリの確認
  fs.ensureDirSync(config.app.outputDir);
  fs.ensureDirSync(path.join(config.app.outputDir, 'requirements'));
  fs.ensureDirSync(path.join(config.app.outputDir, 'designs'));
  fs.ensureDirSync(path.join(config.app.outputDir, 'sessions'));
  
  Logger.info('エージェントコントローラーを初期化しました', 'AgentController');
}
```

3. 実行フローの見直し：
   - エージェントの実行結果（requirements_analysisやexternal_designツールの結果）がファイル保存されるように、`SaveDocumentTool`の呼び出しが正しく行われることを確認

4. 将来的対応：必要なすべてのディレクトリをコード内で一括管理できるよう設定ファイルを拡張
```javascript
// config/index.js に追加
const outputDirs = {
  root: outputDir,
  requirements: path.join(outputDir, 'requirements'),
  designs: path.join(outputDir, 'designs'),
  sessions: path.join(outputDir, 'sessions'),
  diagrams: path.join(outputDir, 'diagrams')
};

// 必要なディレクトリをすべて作成
Object.values(outputDirs).forEach(dir => fs.ensureDirSync(dir));

// ...

config.app.outputDirs = outputDirs;
```

## バグ6：ReActエージェントが分析結果をファイルに保存しない問題

### 現象
要件分析や外部設計を実行すると、必要なディレクトリは作成され、セッションデータも`output/sessions/`に保存されるものの、`output/requirements/`や`output/designs/`ディレクトリに分析結果や設計結果が保存されない。

### 原因
- LangChainの`RequirementAnalysisTool`と`ExternalDesignTool`は実際のファイル保存を行わず、「分析開始します」「設計開始します」という通知を返すだけのプレースホルダーツールである
- これらのツールのコード内のコメントにも「この時点では分析結果はまだ生成されていないので、このツールからは入力を返すだけ」と明記されている
- 分析・設計結果は、ReActエージェントが`SaveDocumentTool`を呼び出して保存する必要があるが、この連携がシステムプロンプトに明記されていない
- エージェントが結果を保存する手順を理解しておらず、分析結果を返すだけでファイル保存を行わない

### 分析結果
- ReActエージェントのシステムプロンプトには「機能要件の特定」や「UML図の作成」などの指示はあるが、「結果を保存する」という明示的な指示がない
- 通常LangChainのReActエージェントは、次のように機能する：
  1. ユーザー入力を受け取り、分析・設計を行う
  2. 分析・設計結果をテキストとして生成
  3. 結果をファイルに保存するために`SaveDocumentTool`を呼び出す必要がある
- しかし、エージェントは自動的にこの最後のステップを実行しない場合がある
- `SaveDocumentTool`は正しく実装されているが、エージェントがこのツールを使うタイミングが明確でない

### 対策内容
1. ReActエージェントのシステムプロンプトを更新して明示的な保存指示を追加する：

```javascript
// システムプロンプトに明示的な指示を追加
const systemPromptTemplate = `
...既存のプロンプト内容...

重要：分析結果や設計結果を生成したら、必ず save_document ツールを使用してファイルに保存してください。
- 要件分析結果は requirements フォルダに保存してください
- 外部設計結果は designs フォルダに保存してください
- ファイル名は適切な名前（プロジェクト名を含む）にしてください
- 内容はマークダウン形式で構造化してください

日本語で応答してください。特に明示的な指示がない限り、応答はマークダウン形式にしてください。
`;
```

2. 各ツールの説明文をより明確にする：

```javascript
class SaveDocumentTool extends StructuredTool {
  constructor() {
    super();
    this.name = "save_document";
    this.description = "生成したドキュメント（要件分析結果や外部設計結果など）をファイルに保存します。分析や設計の結果を必ずこのツールで保存してください。";
    // ... 既存コード ...
  }
  // ... 既存メソッド ...
}
```

3. インターフェースに保存状態を表示する機能を追加：

```javascript
// フロントエンドで保存状態を表示
console.log(chalk.green(`✓ 分析結果を ${filePath} に保存しました`));
```

4. 手動テスト手順と検証方法をREADMEに追加：

```markdown
### 分析・設計結果の確認方法
1. アプリケーションを実行し、要件分析または外部設計を完了させます
2. `output/requirements/` または `output/designs/` ディレクトリを確認します
3. 保存されたマークダウンファイルが存在するはずです
4. ファイルが存在しない場合は、コンソール出力を確認し、エラーメッセージを探してください
```

この問題の対処により、ReActエージェントはユーザーの要件から分析と設計を実行するだけでなく、その結果を確実にファイルシステムに保存するようになります。これにより、ユーザーは生成された分析結果や設計結果を後から参照したり共有したりすることが可能になります。

## バグ7：セッション保存時のディレクトリ不足エラー

### 現象
アプリケーションのセッションを保存しようとすると、以下のようなエラーメッセージが表示される。
```
セッションの保存に失敗しました: ENOENT: no such file or directory, open 'C:\Users\yamaz\Dropbox\work\git\auto-dev\FifthStudy\output\sessions\session_Session_20250302_010606010710.json'
```

### 原因
- アプリケーション起動時に基本的な出力ディレクトリは作成されるが、`sessions`ディレクトリが存在しない場合に自動作成されていなかった
- `agent-controller.js`内の`saveSession`メソッドでは、ファイルを保存する前にディレクトリの存在確認が行われていなかった
- エラーの「ENOENT: no such file or directory」はディレクトリがないことを示している

### 分析結果
- `config/index.js`では必要なディレクトリを作成するコードがあるが、実行時に何らかの理由でセッションディレクトリが存在していなかった
- ファイル保存直前に確実にディレクトリの存在を確認する処理が必要
- `fs-extra`の`ensureDir`メソッドを使用することで、ディレクトリがなければ自動的に作成できる

### 対策内容
1. `agent-controller.js`の`saveSession`メソッドにディレクトリ作成処理を追加：
```javascript
// ディレクトリが存在しない場合は作成
await fs.ensureDir(outputDir);
Logger.info(`出力ディレクトリを確認: ${outputDir}`, 'AgentController');
      
// ファイルへの保存
await fs.writeJson(filePath, sessionData, { spaces: 2 });
```

2. 対策後の効果：
   - セッション保存時に必要なディレクトリが自動的に作成されるため、「no such file or directory」エラーが解消
   - 二重のセーフティネットとなり、設定ファイルでディレクトリ作成に失敗した場合もファイル保存時に再度ディレクトリ作成を試みる
   - ログ出力によりディレクトリ作成状況が確認可能になり、デバッグが容易になる

## バグ8：要件分析と外部設計の結果がテンプレート固定の問題

### 現象
要件分析や外部設計を実行すると、AIエージェントの検討結果が反映されずに固定のテンプレートが出力される。例えば「電卓を開発してください」というリクエストに対して、AIは検討を行うものの、保存される結果は常に同じテンプレートであり、AIの分析内容が反映されていない。

### 原因
- 現在の`RequirementAnalysisTool`と`ExternalDesignTool`の実装では、AIの分析結果を無視して、事前に定義された固定テンプレートをファイルに保存している
- AIエージェントによる分析結果が、最終的なファイル生成に使用されていない
- 実際のAIの分析結果は取得されているが、ファイル内容生成時にその結果が使われずにハードコードされたテンプレートが使用されている

### 分析結果
- `analysis-tools.js`内の各ツールの`_call`メソッドでは、固定の文字列テンプレートを使用してファイルを生成している
- AIエージェントが`requirements_analysis`や`external_design`ツールを呼び出してその結果を取得しているが、その結果がファイル内容に反映されていない
- システムの現在の設計では、分析結果を保存するプロセスとAIがその内容を生成するプロセスが適切に連携していない

### 対策案
本問題は単純なバグではなく、システムの設計に関わる大きな課題であるため、以下の方針で再設計が必要：

1. **AIエージェントの分析結果をファイルに保存する方式の再設計**：
   - AIエージェントが分析した結果をそのままファイルの内容として使用する
   - 現在のReActエージェントのプロンプトを修正し、詳細な分析結果を生成するよう指示
   - 固定テンプレートを排除し、AIが生成した内容をそのまま保存

2. **ツールチェーンの改善**：
   - `requirements_analysis`ツールの結果を`save_document`ツールに渡して保存する明確なフロー
   - 同様に`external_design`ツールの結果も`save_document`ツールを通じて保存
   - ツール間の結果受け渡しを適切に管理するメカニズムの構築

3. **プロンプトエンジニアリングの強化**：
   - AIに詳細な要件分析や設計を生成させるためのプロンプトの改善
   - 構造化された結果を返すようAIに指示する明確なガイドラインの追加
   - 日本語文脈での適切な要件分析と設計ドキュメント生成のためのプロンプト最適化

この課題の解決には、単なるコード修正ではなく、システムの基本設計を見直す必要があり、明日の作業で取り組む予定。

## 総合的な解決策と教訓

### 主な教訓
1. **LangChainのバージョン更新に注意**：
   - APIの変更や内部処理の変更が互換性の問題を引き起こす可能性がある
   - 特に0.3.xから0.4.xへの更新では大きな変更がある

2. **変数のライフサイクル管理**：
   - 初期化時と実行時の両方で変数を正しく提供する必要がある
   - LangChainの内部的な変数処理を理解することが重要

3. **明示的な設定の重要性**：
   - 自動検出や自動切替の機能に頼らず、明示的に設定を行うほうが安全
   - Azure/OpenAIのような外部APIの連携では特に重要

### 最終的な解決策のポイント
- プロンプトテンプレート内の変数プレースホルダーを正しい形式で維持
- 初期化時と実行時の両方で必要な変数値を提供
- APIエンドポイントやモード設定を明示的に指定
- 変数の型と名前をLangChainの期待に合わせる

### 今後のバグ対応のためのヒント
1. エラーメッセージを注意深く分析する
2. LangChainのAPIドキュメントを確認する
3. 複雑な操作よりも基本的なアプローチを優先する
4. 変更後は段階的にテストし、各ステップで動作を確認する
5. クロスプラットフォーム対応を意識し、OSの違いに敏感になる

---

本ドキュメントは、ReActエージェント実装において遭遇した主要なバグと解決策をまとめたものです。今後新たなバグが発生した場合は、同様の形式で情報を追加し、知識ベースとして活用してください。

最終更新日: 2025年2月28日 

## 4. SaveDocumentToolのエラー

### 現象

ReActエージェントがSaveDocumentToolを使用して文書を保存しようとすると、以下のようなエラーが発生する：

```
Error: Tool invocation failed: TypeError: saveDocumentTool.invoke is not a function
```

または

```
Error: Tool invocation failed: TypeError: Cannot read properties of undefined (reading 'fileName')
```

### 原因

1. LangChain v0.3ではツールの呼び出し方法が変更されており、`invoke`メソッドではなく`call`メソッドを使用する必要がある
2. ReActツールアダプターを介してツールを呼び出す際に、入力フォーマットが正しく処理されていない
3. コンテンツから適切にファイル名を抽出するロジックが不十分だった

### 分析結果

LangChain v0.3では、ツールの呼び出し方法として、StructuredToolでは`call`メソッドを、一部のツールでは`_call`メソッドを使用する仕様に変更されています。また、入力データの形式も変更されており、特にReActエージェントからの入力を適切に処理する必要があります。

従来のコードでは、以下のような問題がありました：
- `invoke`メソッドを使用している（現在は非推奨または存在しない）
- ファイル名の抽出ロジックがマークダウンの最初の行から取得するシンプルなものだった
- エラーハンドリングが不十分だった

### 解決策

1. **ツール呼び出しメソッドの変更**:
```javascript
// 修正前
const result = await saveDocumentTool.invoke(content);

// 修正後
const result = await saveDocumentTool.call(structuredInput);
// または動的に適切なメソッドを選択
const methodToUse = originalTool._call ? '_call' : (originalTool.call ? 'call' : 'invoke');
const result = await originalTool[methodToUse](structuredInput);
```

2. **入力処理の改善**:
```javascript
// 修正前
const fileName = content.split('\n')[0].replace('# ', '');

// 修正後
// コンテンツからファイル名を抽出する改善されたロジック
const lines = content.split('\n');
let fileName = '';
for (const line of lines) {
  if (line.trim().startsWith('# ')) {
    fileName = line.trim().replace(/^# /, '').trim();
    break;
  }
}

// 構造化された入力を作成
const structuredInput = {
  fileName: fileName,
  content: content,
  folder: folder || 'output',
  overwrite: true
};
```

3. **エラーハンドリングの強化**:
```javascript
try {
  // 適切なメソッドを動的に選択して呼び出す
  const methodToUse = originalTool._call ? '_call' : (originalTool.call ? 'call' : 'invoke');
  console.log(`Using method ${methodToUse} to call tool`);
  const result = await originalTool[methodToUse](structuredInput);
  return result;
} catch (error) {
  console.error('Error calling tool:', error);
  return `Error: ${error.message}`;
}
```

### 教訓と今後の対策

1. **API変更の追跡**: LangChainなどの外部ライブラリのバージョン更新時には、APIの変更点を詳細に確認する
2. **ツール呼び出しの標準化**: すべてのツールで統一された呼び出し方法を実装し、アダプターパターンを活用する
3. **詳細なエラーロギング**: 問題発生時にはより詳細な情報をログに記録し、素早くデバッグできるようにする
4. **入力データの検証**: ツールに渡す前に入力データの形式が正しいことを確認する

### 進捗状況

- [x] ツール呼び出しメソッドを`call`または`_call`に変更
- [x] ファイル名抽出のロジックを改善
- [x] 構造化入力の処理方法を標準化
- [x] エラーハンドリングとロギングを強化
- [x] テストを実施して正常動作を確認

### 参考資料

- [LangChain v0.3ドキュメント](https://js.langchain.com/docs/modules/tools/how_to/create_tools)
- [LangChain Tool Schema](https://js.langchain.com/docs/api/tools_schema/classes/StructuredTool)

最終更新日: 2025年3月1日 