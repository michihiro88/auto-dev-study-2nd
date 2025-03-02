# LangChain v0.3 ReActAgentAdapter統合ガイド

## 背景

LangChain v0.3へのアップグレードにより、以下の主要な問題が発生しました：

1. **初期化の問題**: プロンプト設定に関連するエラーが発生し、`["tools","tool_names"]`が見つからないというエラーが表示される
2. **ツール実行の問題**: ツールの入力形式がJSONからStringに変更されたため、スキーマミスマッチが発生する

## 準備ステップ

### インポートの変更

まず、`agent-controller.js`ファイルに新しい`ReActAgentAdapter`クラスを追加するための変更を行います：

```javascript
// 既存のインポート
const { ReActAgent } = require("./agents/react-agent");
// 新しいインポート
const { ReActAgentAdapter } = require("./agents/react-agent-adapter");
```

### ReActToolAdapterの確認

`FifthStudy/src/tools/react-tool-adapter.js`に`ReActToolAdapter`クラスが正しく実装されていることを確認します。このクラスは、ReActエージェントからの文字列入力をJSONに変換するためのものです。

## AgentControllerクラスの修正

### コンストラクタの変更

`AgentController`クラスのコンストラクタを変更して、`ReActAgentAdapter`を使用するように修正します：

```javascript
constructor(config = {}) {
  // 既存のコード...
  
  // 修正前:
  // this.agent = new ReActAgent({
  //   tools: this.tools,
  //   model: this.model,
  //   verbose: true
  // });
  
  // 修正後:
  this.agent = new ReActAgentAdapter({
    tools: this.tools,
    model: this.model,
    verbose: true
  });
  
  // 既存のコード...
}
```

### メソッドの互換性チェック

すべてのメソッドが`ReActAgentAdapter`と互換性があることを確認します。特に、`runAgent`メソッドが適切に動作するか確認してください。

```javascript
async runAgent(userInput) {
  try {
    // 既存のコード...
    
    // エージェントの実行
    const result = await this.agent.call({
      input: userInput
    });
    
    // 既存のコード...
  } catch (error) {
    console.error("Agent execution error:", error);
    return `エラーが発生しました: ${error.message}`;
  }
}
```

## SaveDocumentToolの修正

SaveDocumentToolの呼び出しに関する問題が発生しています。このツールを正しく動作させるためには、以下の修正が必要です：

### test-react-adapter.jsの修正

テスト用のスクリプト`test-react-adapter.js`を修正して、SaveDocumentToolを正しく呼び出せるようにします：

```javascript
async function testSaveDocument() {
  console.log("ドキュメント保存テスト");
  console.log("保存したい文書を入力してください（先頭行がファイル名になります）：");
  const content = await question("");

  try {
    // 修正前:
    // const result = await saveDocumentTool.invoke(content);
    
    // 修正後:
    // コンテンツからファイル名を抽出
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
      folder: 'output',
      overwrite: true
    };
    
    console.log(`ファイル名: ${fileName}`);
    
    // callメソッドを使用して呼び出し
    const result = await saveDocumentTool.call(structuredInput);
    console.log("保存結果:", result);
  } catch (error) {
    console.error("保存エラー:", error);
  }
}
```

### ReActToolAdapterの修正

ReActToolAdapterにSaveDocumentTool用の特別な処理を追加します：

```javascript
// FifthStudy/src/tools/react-tool-adapter.js

class ReActToolAdapter {
  constructor(originalTool) {
    this.originalTool = originalTool;
    this.name = originalTool.name;
    this.description = originalTool.description;
    this.schema = originalTool.schema;
  }
  
  async invoke(input) {
    try {
      const originalTool = this.originalTool;
      
      // 入力が文字列の場合、ツールに応じて適切に処理
      if (typeof input === 'string') {
        // SaveDocumentTool用の特別な処理
        if (this.name === 'save_document') {
          // コンテンツからファイル名を抽出
          const lines = input.split('\n');
          let fileName = '';
          for (const line of lines) {
            if (line.trim().startsWith('# ')) {
              fileName = line.trim().replace(/^# /, '').trim();
              break;
            }
          }
          
          // 構造化された入力を作成
          const structuredInput = {
            fileName: fileName || 'untitled',
            content: input,
            folder: 'output',
            overwrite: true
          };
          
          // 適切なメソッドを選択して呼び出し
          const methodToUse = originalTool._call ? '_call' : (originalTool.call ? 'call' : 'invoke');
          return await originalTool[methodToUse](structuredInput);
        }
        
        // 他のツール用の一般的な処理
        // ...
      }
      
      // 既存のコード...
    } catch (error) {
      console.error(`Tool ${this.name} invocation error:`, error);
      return `Error: ${error.message}`;
    }
  }
}
```

## テスト手順

以下の手順で実装をテストします：

1. **テストスクリプトの実行**:
   ```
   node FifthStudy/src/test-react-adapter.js
   ```

2. **ドキュメント保存のテスト**:
   プロンプトで`testdoc`と入力し、以下のようなフォーマットでテスト文書を入力します：
   ```
   # テスト文書
   
   これはテスト文書です。
   日本語の文章も正しく保存されるかテストします。
   ```

3. **結果の確認**:
   `output`フォルダに`テスト文書.md`が正しく保存されているか確認します。

## 実装ステータス

- [x] ReActToolAdapterの実装完了
- [x] ReActAgentAdapterの実装完了
- [x] AgentControllerへの統合完了
- [x] SaveDocumentToolの修正完了
- [x] テストの実施と確認完了

## トラブルシューティング

実装中に以下の問題が発生する場合があります：

1. **「invoke is not a function」エラー**:
   - LangChain v0.3では`invoke`ではなく`call`または`_call`メソッドを使用する必要があります
   - ツールごとに利用可能なメソッドを確認し、適切なメソッドを選択してください

2. **「Cannot read properties of undefined (reading 'fileName')」エラー**:
   - 入力からファイル名が正しく抽出されていない可能性があります
   - 入力形式を確認し、ファイル名抽出ロジックを修正してください

## 次のステップ

1. 他のツールについても同様の修正を適用
2. エラーハンドリングの強化
3. ユーザーへのフィードバック改善
4. 完全なドキュメント作成

最終更新日: 2025年3月1日 