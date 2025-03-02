# LangChain v0.3 ReActエージェント実装計画書

## 1. 現状の問題点

LangChain v0.3でReActエージェントを実装する過程で以下の問題が発生しています：

1. **初期化時の問題**:
   - `Provided prompt is missing required input variables: ["tools","tool_names"]` というエラーが発生
   - `Cannot read properties of undefined (reading 'inputVariables')` というエラーも発生

2. **ツール実行時の問題**:
   - 初期化が成功した後も、ツール実行時に `Received tool input did not match expected schema` というエラーが発生
   - LangChain v0.3のReActエージェントが、ツールに文字列型で入力を渡す仕様に変更されたため

## 2. 問題の分析

### 2.1 LangChain v0.3の仕様変更

LangChain v0.3では、以下の仕様変更が行われています：

1. ReActエージェントのプロンプト形式が変更され、`tools`と`tool_names`が必須変数として要求されるようになった
2. LangChain Hubからプロンプトを取得する機能が追加された
3. ReActエージェントがツールを呼び出す際の形式が変更され、ツール入力が単純な文字列として渡されるようになった

### 2.2 既存ツールの仕様

現在のツール実装は、以下のように構造化された入力を期待しています：

```javascript
// 要件分析ツールの例
this.schema = z.object({
  projectName: z.string().describe("プロジェクト名"),
  requirements: z.string().describe("分析する要件の説明文"),
  outputFormat: z.enum(["markdown", "json"]).optional().describe("出力形式（デフォルトは markdown）"),
});
```

このスキーマ定義により、ツールはJSON形式の入力を期待しますが、ReActエージェントは単純な文字列を渡すため、不一致が発生しています。

## 3. 解決策

### 3.1 初期化問題の解決

初期化時の問題は、LangChain Hubから標準プロンプトを取得することで解決します：

```javascript
// HubからデフォルトのReActプロンプトを取得
try {
  const prompt = await pull("hwchase17/react");
  Logger.info("Hubからプロンプトを取得しました", "ReActAgent");
  
  // ReActエージェントの作成
  this.agent = await createReactAgent({
    llm: this.llm.model,
    tools: this.tools,
    prompt: prompt
  });
} catch (promptError) {
  // フォールバック処理
}
```

### 3.2 ツール実行問題の解決

ツール実行時の問題を解決するために、以下のアプローチを採用します：

1. **ツールアダプターパターン**: 既存ツールをラップし、文字列入力をJSONに変換するアダプターを作成
2. **入力解析ロジック**: 文字列からツールが期待するJSON形式に変換するロジック実装
3. **エージェントアダプター**: ReActエージェントの動作に合わせた新しいエージェントアダプタークラスの実装

## 4. 実装計画

### 4.1 ツールアダプターの実装

`ReActToolAdapter` クラスを作成し、以下の機能を実装します：

1. 既存ツールをラップする機能
2. 文字列入力をJSONに変換する機能
3. ツール固有の入力パターン解析機能

```javascript
class StringInputToolWrapper extends StructuredTool {
  constructor(originalTool) {
    super();
    this.name = originalTool.name;
    this.description = originalTool.description;
    this.originalTool = originalTool;
    
    // 入力スキーマを文字列型に変更
    this.schema = z.string().describe(`...`);
  }
  
  async _call(inputStr) {
    // 文字列をJSONに変換
    const jsonInput = this._parseStringToJson(inputStr);
    
    // 元のツールを呼び出す
    return await this.originalTool.invoke(jsonInput);
  }
}
```

### 4.2 エージェントアダプターの実装

`ReActAgentAdapter` クラスを実装し、以下の機能を追加します：

1. ツールアダプターを使用して既存ツールをラップ
2. Hubからプロンプトを取得して初期化する機能
3. 既存のReActAgentと同じインターフェースの維持

```javascript
class ReActAgentAdapter {
  constructor(options = {}) {
    // 既存ツールをラップ
    this.adaptedTools = ReActToolAdapter.wrapTools(this.originalTools);
  }
  
  async initialize() {
    // HubからReActプロンプトを取得
    const prompt = await pull("hwchase17/react");
    
    // アダプター付きツールでエージェントを作成
    this.agent = await createReactAgent({
      llm: this.llm.model,
      tools: this.adaptedTools,
      prompt: prompt
    });
  }
}
```

### 4.3 テスト計画

1. **単体テスト**: ツールアダプターが正しく文字列をJSONに変換できるかテスト
2. **結合テスト**: ラップされたツールがReActエージェントから呼び出された際に正しく動作するかテスト
3. **エンドツーエンドテスト**: 実際のシナリオでエージェントが問題なく動作するかテスト

## 5. 実装スケジュール

1. **フェーズ1**: ツールアダプターの実装 (1日) ✓
2. **フェーズ2**: エージェントアダプターの実装 (1日) ✓
3. **フェーズ3**: テストと修正 (1-2日) - 進行中
4. **フェーズ4**: 本番環境への統合 (1日) - 予定

## 6. 検討事項と今後の課題

1. **ツール入力解析の堅牢性**: 複雑な入力をどこまで解析できるか検討が必要
2. **エラーハンドリング**: ツール入力解析失敗時の適切なフォールバック処理
3. **LangChainの今後の更新**: v0.3以降の更新に追従するための対応方針
4. **モデル互換性**: 異なるモデル（GPT-4, Claudeなど）での動作確認
5. **ディレクトリ構造の整理**: `doc`と`docs`の統合により、参照パスの更新が必要

## 7. 対応状況

- [x] 問題の分析と原因特定
- [x] 初期化問題の解決（プロンプト取得）
- [x] ツールアダプターの設計と実装 (`react-tool-adapter.js`)
- [x] エージェントアダプターの設計と実装 (`react-agent-adapter.js`)
- [x] テスト用スクリプトの作成 (`test-react-adapter.js`)
- [x] テストスクリプトの実行と基本動作確認
- [ ] AgentControllerへの統合
- [ ] 本番環境のテストと最終調整
- [x] ドキュメント作成と知見の共有
- [x] ディレクトリ構造の整理（`docs`から`doc`への移動）

## 8. 次のアクション

1. ✓ テストスクリプト `test-react-adapter.js` の実行によるアダプターの動作確認
2. ✓ 基本機能の確認と必要に応じた修正
3. [ ] 以下のような修正を`AgentController`クラスに適用し、新しいアダプターを統合する
   ```javascript
   // AgentControllerクラスのコンストラクタを更新
   constructor() {
     // ReActAgentからReActAgentAdapterに変更
     this.agent = new ReActAgentAdapter();
     this.initialized = false;
     this.activeSession = null;
     this.sessionHistory = [];
     
     Logger.info('エージェントコントローラーを初期化しました', 'AgentController');
   }
   ```
4. [ ] 統合後の動作テストと必要に応じたデバッグ
5. [ ] プロダクション環境への適用 