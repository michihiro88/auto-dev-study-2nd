# LangChain v0.3 ReActエージェントのデバッグ記録

## 現在の問題

LangChain v0.3へのアップグレードに伴い、以下の問題が発生しています：

1. **初期化の問題**: 
   - エラーメッセージ: `Missing required input variables: ["tools","tool_names"]`
   - エラーメッセージ: `Cannot read properties of undefined (reading 'inputVariables')`

2. **ツール実行の問題**:
   - Hubからプロンプトを取得して初期化に成功しても、実行時にツールの入力がスキーマに一致しないエラーが発生

## 初期化問題の解決

Hubから標準のReActプロンプトを取得することで初期化の問題を解決できました：

```javascript
import { pull } from "langchain/hub";
import { createReactAgent } from "langchain/agents/react";

// Hubからプロンプトを取得
let promptFromHub;
try {
  promptFromHub = await pull("langchain/react");
  console.log("Hubからプロンプトを取得しました");
} catch (error) {
  console.error("Hubからプロンプトの取得に失敗しました:", error);
  return;
}

// ReActエージェントの作成
const agent = await createReactAgent({
  llm: model,
  tools: wrappedTools,
  prompt: promptFromHub
});

console.log("ReActエージェントの初期化に成功しました");
```

これにより、初期化時のエラーは解消されましたが、実行時には別の問題が発生しています。

## ツール実行問題の解決

### 問題の分析

ReActエージェントがツールを呼び出す際、LangChain v0.3では入力形式が変更されています：

1. v0.2: ツールはJSON形式の入力を期待
2. v0.3: ReActエージェントからツールへの入力は文字列

これにより、以下のようなエラーが発生します：
```
Tool execution failed: Error: Missing required fields: ["fileName","content"]
```

### 解決方法: ReActToolAdapterの実装

文字列入力をJSONに変換するアダプターを実装しました：

```javascript
class ReActToolAdapter {
  constructor(originalTool) {
    this.originalTool = originalTool;
    this.name = originalTool.name;
    this.description = originalTool.description;
    this.schema = originalTool.schema;
  }
  
  async invoke(input) {
    try {
      // 文字列入力を解析してJSON形式に変換
      let structuredInput;
      if (typeof input === 'string') {
        // ツール固有の変換ロジック
        if (this.name === 'save_document') {
          // SaveDocumentToolの特殊処理
          structuredInput = this.parseDocumentInput(input);
        } else {
          // 一般的な処理
          try {
            structuredInput = JSON.parse(input);
          } catch (e) {
            // JSONパースに失敗した場合、シンプルな入力として扱う
            structuredInput = { input: input };
          }
        }
      } else {
        // すでに構造化されている場合はそのまま使用
        structuredInput = input;
      }
      
      // 適切なメソッドを選択して呼び出し
      const result = await this.callOriginalTool(structuredInput);
      return result;
    } catch (error) {
      console.error(`Tool ${this.name} invocation error:`, error);
      return `Error: ${error.message}`;
    }
  }
  
  async callOriginalTool(structuredInput) {
    const originalTool = this.originalTool;
    // ツールの利用可能なメソッドを動的に判断
    const methodToUse = originalTool._call ? '_call' : 
                       (originalTool.call ? 'call' : 'invoke');
    
    console.log(`Using method ${methodToUse} to call tool ${this.name}`);
    return await originalTool[methodToUse](structuredInput);
  }
  
  parseDocumentInput(input) {
    // SaveDocumentTool向けの特殊処理
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
    return {
      fileName: fileName || 'untitled',
      content: input,
      folder: 'output',
      overwrite: true
    };
  }
}
```

### SaveDocumentTool固有の問題と解決

SaveDocumentToolには特有の問題がありました：

1. **問題点**:
   - `invoke`メソッドが廃止されて`call`メソッドに変更
   - ファイル名の抽出処理が不十分
   - エラー処理が不足

2. **解決方法**:
   ```javascript
   async function testSaveDocument() {
     console.log("ドキュメント保存テスト");
     console.log("保存したい文書を入力してください（先頭行がファイル名になります）：");
     const content = await question("");
   
     try {
       // 修正前: const result = await saveDocumentTool.invoke(content);
       
       // 修正後:
       // コンテンツからファイル名を適切に抽出
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
         fileName: fileName || 'untitled',
         content: content,
         folder: 'output',
         overwrite: true
       };
       
       console.log(`ファイル名: ${fileName}`);
       
       // callメソッドを使用
       const result = await saveDocumentTool.call(structuredInput);
       console.log("保存結果:", result);
     } catch (error) {
       console.error("保存エラー:", error);
     }
   }
   ```

### テスト結果

修正後にテストを実行した結果：

```
> node FifthStudy/src/test-react-adapter.js
利用可能なコマンド:
1. testadapter - ReActエージェントアダプターのテスト
2. testdoc - ドキュメント保存テスト
コマンドを入力してください: testdoc
ドキュメント保存テスト
保存したい文書を入力してください（先頭行がファイル名になります）：
# テスト文書

これはテスト文書です。
日本語の文章も正しく保存されるかテストします。

ファイル名: テスト文書
保存結果: ファイル 'output/テスト文書.md' に保存しました
```

## ReActAgentAdapterの実装

エージェント側のアダプターも実装し、ツールを適切にラップしました：

```javascript
class ReActAgentAdapter {
  constructor(config) {
    this.config = config;
    this.agent = null;
    this.tools = config.tools;
    this.model = config.model;
    this.verbose = config.verbose || false;
  }
  
  async initialize() {
    try {
      // Hubからプロンプトを取得
      const promptFromHub = await pull("langchain/react");
      
      // ツールをReActToolAdapterでラップ
      const wrappedTools = this.tools.map(tool => new ReActToolAdapter(tool));
      
      // ReActエージェントの作成
      this.agent = await createReactAgent({
        llm: this.model,
        tools: wrappedTools,
        prompt: promptFromHub
      });
      
      // エージェント実行チェーンの作成
      this.executor = AgentExecutor.fromAgentAndTools({
        agent: this.agent,
        tools: wrappedTools,
        verbose: this.verbose
      });
      
      return true;
    } catch (error) {
      console.error("ReActAgentAdapter initialization error:", error);
      throw error;
    }
  }
  
  async call(input) {
    if (!this.agent) {
      await this.initialize();
    }
    
    try {
      return await this.executor.invoke(input);
    } catch (error) {
      console.error("ReActAgentAdapter execution error:", error);
      throw error;
    }
  }
}
```

## 今回の学び

1. **LangChainのバージョン間の変更点**:
   - プロンプト形式の変更
   - ツール呼び出しインターフェースの変更
   - Hub機能の導入

2. **アダプターパターンの有効性**:
   - 既存コードを大幅に変更せず新APIに対応
   - ツール固有の処理をカプセル化

3. **エラーハンドリングの重要性**:
   - 詳細なエラーメッセージのログ記録
   - 段階的なデバッグアプローチ
   - 正確な問題特定

4. **テストの重要性**:
   - 個別機能のテスト
   - エンドツーエンドのテスト
   - エラーケースのテスト

## 次のステップ

1. すべてのツールがReActToolAdapterを通じて正しく動作することの確認
2. ReActAgentAdapterを本番の`AgentController`クラスに統合
3. エラーハンドリングとログの改善
4. 詳細なドキュメントの作成

最終更新日: 2025年3月1日 