/**
 * ReActエージェントアダプターのテスト用スクリプト
 */
import readline from 'readline';
import dotenv from 'dotenv';
import Logger from './utils/logger.js';
import ReActAgentAdapter from './agents/react-agent-adapter.js';
import ReActToolAdapter from './tools/react-tool-adapter.js';
import { saveDocumentTool } from './tools/analysis-tools.js';

// 環境変数の読み込み
dotenv.config();

// ターミナルインターフェースの作成
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

/**
 * 質問を促してユーザーの入力を取得する
 * @param {string} prompt - 質問文
 * @returns {Promise<string>} - ユーザーの回答
 */
const question = (prompt) => {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer);
    });
  });
};

/**
 * save_documentツールを直接テストする関数
 * @param {ReActAgentAdapter} agent - ReActエージェントアダプター
 * @param {string} content - 保存するコンテンツ
 * @returns {Promise<string>} - 処理結果
 */
const testSaveDocument = async (agent, content) => {
  try {
    console.log('\n===== save_documentツールのテスト実行 =====');
    console.log(`コンテンツ: ${content.substring(0, 50)}...`);
    
    // ファイル名とコンテンツを解析
    const contentLines = content.split(/\\n|\n/);
    let fileName = `テスト文書_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.md`;
    let documentContent = content;
    
    // ファイル名の行を探す
    const fileNameLine = contentLines.find(line => line.match(/^ファイル名[：:]/i));
    if (fileNameLine) {
      const fileNameMatch = fileNameLine.match(/ファイル名[：:]\s*(.+?)$/i);
      if (fileNameMatch && fileNameMatch[1].trim()) {
        fileName = fileNameMatch[1].trim();
        // 拡張子がなければ追加
        if (!fileName.includes('.')) {
          fileName += '.md';
        }
        
        // コンテンツからファイル名の行を除外
        documentContent = contentLines
          .filter(line => !line.match(/^ファイル名[：:]/i))
          .join('\n');
      }
    }
    
    // フォルダを特定
    let folder = 'output';
    if (content.toLowerCase().includes('要件') || content.toLowerCase().includes('requirement')) {
      folder = 'requirements';
    } else if (content.toLowerCase().includes('設計') || content.toLowerCase().includes('design')) {
      folder = 'designs';
    }
    
    // 構造化データを構築
    const structuredInput = {
      fileName: fileName,
      content: documentContent,
      folder: folder,
      overwrite: false
    };
    
    console.log(`構造化データを構築: ${JSON.stringify(structuredInput, null, 2)}`);
    
    // importしたsaveDocumentToolを直接使用
    try {
      // _callメソッドを直接使用
      const result = await saveDocumentTool._call(structuredInput);
      console.log(`ツール呼び出し結果: ${result}`);
      return result;
    } catch (directError) {
      Logger.error(directError, 'SaveDocumentDirectTest');
      console.error('直接呼び出しでのエラー:', directError.message);
      
      // エラーの詳細情報を表示
      if (directError.code) {
        console.error(`エラーコード: ${directError.code}`);
      }
      if (directError.cause) {
        console.error(`エラーの原因: ${directError.cause instanceof Error ? directError.cause.message : directError.cause}`);
      }
      
      return `エラー: ${directError.message}`;
    }
  } catch (error) {
    Logger.error(error, 'Test');
    
    console.error(`テストエラー: ${error.message}`);
    if (error.code) {
      console.error(`エラーコード: ${error.code}`);
    }
    if (error.cause) {
      console.error(`エラー原因: ${error.cause instanceof Error ? error.cause.message : error.cause}`);
    }
    
    return `エラー: ${error.message}`;
  }
};

/**
 * メインの実行関数
 */
const main = async () => {
  console.log('\n------------------------------------------');
  console.log('  ReActエージェントアダプターテスト');
  console.log('  LangChain v0.3対応版');
  console.log('------------------------------------------\n');
  
  try {
    // ReActエージェントアダプターのインスタンス作成
    const agent = new ReActAgentAdapter();
    
    // エージェントの初期化
    console.log('エージェントを初期化しています...');
    await agent.initialize();
    console.log('エージェントの初期化が完了しました！');
    
    // 利用可能なツールを表示
    const tools = agent.getAvailableTools();
    console.log('\n利用可能なツール:');
    tools.forEach(tool => {
      console.log(`- ${tool.name}: ${tool.description.substring(0, 100)}...`);
    });
    
    // 対話モード
    let running = true;
    
    while (running) {
      const input = await question('\nプロンプトを入力してください（終了するには "exit" と入力、"testdoc" で文書保存テスト）: ');
      
      if (input.toLowerCase() === 'exit') {
        running = false;
        console.log('テストを終了します...');
        continue;
      }
      
      // 直接文書保存テスト
      if (input.toLowerCase() === 'testdoc') {
        console.log('\n--- 文書保存テスト ---');
        console.log('ファイル名を指定する場合は「ファイル名: あなたのファイル名.拡張子」の形式を含めてください');
        console.log('フォルダは内容に基づいて自動的に選択されます（requirements, designs, outputなど）');
        console.log('改行は「\\n」または実際の改行で入力できます');
        const testContent = await question('保存するテスト内容を入力してください: ');
        const result = await testSaveDocument(agent, testContent);
        console.log(`\n保存テスト結果: ${result}`);
        continue;
      }
      
      console.log('\nエージェントが処理中...');
      try {
        const result = await agent.run(input);
        console.log('\n結果:');
        console.log(result.output);
        
        console.log('\n実行ステップ:');
        result.intermediateSteps.forEach((step, index) => {
          console.log(`\nステップ ${index + 1}:`);
          if (step.action) {
            console.log(`ツール: ${step.action.tool}`);
            console.log(`入力: ${JSON.stringify(step.action.toolInput)}`);
            
            // save_documentツールの場合は特別な処理
            if (step.action.tool === 'save_document') {
              console.log(`\n[注意] save_documentツールが呼び出されました`);
              console.log(`入力文字列の長さ: ${step.action.toolInput.length}文字`);
              console.log(`入力文字列タイプ: ${typeof step.action.toolInput}`);
              console.log(`入力文字列の先頭100文字:`);
              console.log(`"${typeof step.action.toolInput === 'string' ? step.action.toolInput.substring(0, 100) : JSON.stringify(step.action.toolInput).substring(0, 100)}..."`);
            }
          }
          if (step.observation) {
            console.log(`結果: ${step.observation}`);
            
            // ファイル保存の結果を特別に表示
            if (step.observation.includes('ドキュメントを保存しました')) {
              console.log(`\n[成功] ${step.observation}`);
              console.log('ファイルが正常に保存されました。保存先を確認してください。');
            }
          }
        });
      } catch (error) {
        console.error(`\nエラーが発生しました: ${error.message}`);
        Logger.error(error, 'Main');
        
        // エラーの詳細情報を表示
        if (error.code) {
          console.error(`エラーコード: ${error.code}`);
        }
        if (error.cause) {
          console.error(`エラー原因: ${error.cause instanceof Error ? error.cause.message : error.cause}`);
        }
        
        console.error('\nエラーの詳細はログファイルを確認してください。');
      }
    }
  } catch (error) {
    console.error(`\n初期化エラー: ${error.message}`);
    Logger.error(error, 'Main');
    
    // エラーの詳細情報を表示
    if (error.code) {
      console.error(`エラーコード: ${error.code}`);
    }
    if (error.cause) {
      console.error(`エラー原因: ${error.cause instanceof Error ? error.cause.message : error.cause}`);
    }
    
    console.error('\nエラーの詳細はログファイルを確認してください。');
  } finally {
    rl.close();
  }
};

// スクリプトの実行
main().catch(error => {
  Logger.error(error, 'Main');
  console.error('予期しないエラーが発生しました:', error.message);
  
  // エラーの詳細情報を表示
  if (error.code) {
    console.error(`エラーコード: ${error.code}`);
  }
  if (error.cause) {
    console.error(`エラー原因: ${error.cause instanceof Error ? error.cause.message : error.cause}`);
  }
  
  console.error('\nエラーの詳細はログファイルを確認してください。');
  process.exit(1);
}); 