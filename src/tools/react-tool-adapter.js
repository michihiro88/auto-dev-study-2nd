/**
 * LangChain v0.3 ReActエージェント用ツールアダプター
 * 文字列入力をツールが期待するJSON形式に変換する
 */
import { StructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import Logger from '../utils/logger.js';

/**
 * ReActツールアダプター - 文字列入力をJSON形式に変換する
 */
class ReActToolAdapter {
  /**
   * 構造化ツールにアダプターをラップする
   * @param {Array<StructuredTool>} tools - 元のツール配列 
   * @returns {Array<StructuredTool>} - ラップされたツール配列
   */
  static wrapTools(tools) {
    return tools.map(tool => this.wrapTool(tool));
  }
  
  /**
   * 単一ツールをラップする
   * @param {StructuredTool} originalTool - 元のツール
   * @returns {StructuredTool} - ラップされたツール
   */
  static wrapTool(originalTool) {
    const adaptedTool = new StringInputToolWrapper(originalTool);
    return adaptedTool;
  }
}

/**
 * 文字列入力を受け付けるようにツールをラップするクラス
 */
class StringInputToolWrapper extends StructuredTool {
  /**
   * コンストラクタ
   * @param {StructuredTool} originalTool - ラップするオリジナルのツール
   */
  constructor(originalTool) {
    super();
    this.name = originalTool.name;
    this.description = originalTool.description;
    this.originalTool = originalTool;
    
    // 元のスキーマから文字列スキーマを作成
    this.schema = z.string().describe(`このツールには文字列で指示を渡してください。
オリジナルスキーマは以下の通りです: ${JSON.stringify(originalTool.schema.shape, null, 2)}`);
  }
  
  /**
   * ツールを実行する
   * @param {string} inputStr - 文字列入力
   * @returns {Promise<string>} - ツールの実行結果
   */
  async _call(inputStr) {
    try {
      Logger.info(`ツールアダプター: "${this.name}" に入力文字列を変換します`, 'StringInputToolWrapper');
      
      // 入力が文字列でない場合は文字列に変換
      if (typeof inputStr !== 'string') {
        Logger.warn(`入力が文字列ではありません。型: ${typeof inputStr}、値: ${JSON.stringify(inputStr)}`, 'StringInputToolWrapper');
        // オブジェクトの場合はJSON文字列に変換、それ以外の場合はString()を使用
        if (typeof inputStr === 'object') {
          inputStr = JSON.stringify(inputStr);
        } else {
          inputStr = String(inputStr);
        }
        Logger.info(`入力を文字列に変換しました: "${inputStr.substring(0, 50)}${inputStr.length > 50 ? '...' : ''}"`, 'StringInputToolWrapper');
      }
      
      // 入力が日本語か英語かを判断（簡易的な方法）
      const isJapanese = /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf]/.test(inputStr);
      Logger.info(`入力言語: ${isJapanese ? '日本語' : '英語/その他'}`, 'StringInputToolWrapper');
      
      // 文字列入力から構造化JSONを推測する
      const jsonInput = this._parseStringToJson(inputStr);
      
      Logger.info(`文字列入力 "${inputStr.substring(0, 50)}..." を JSON に変換: ${JSON.stringify(jsonInput)}`, 'StringInputToolWrapper');
      
      // 元のツールを呼び出す - LangChain v0.3対応
      const originalTool = this.originalTool;
      
      // 利用可能なメソッドを動的に判断
      const methodToUse = originalTool._call ? '_call' : 
                         (originalTool.call ? 'call' : 'invoke');
      
      Logger.info(`ツール "${this.name}" のメソッド "${methodToUse}" を使用します`, 'StringInputToolWrapper');
      return await originalTool[methodToUse](jsonInput);
    } catch (error) {
      // エラーオブジェクトをそのままLoggerに渡してスタックトレースを記録
      Logger.error(error, 'StringInputToolWrapper');
      
      // 詳細なエラー情報を記録（ここでも型チェック）
      if (typeof inputStr === 'string') {
        Logger.error(`ツール: ${this.name}, 入力文字列長: ${inputStr.length}文字, 入力先頭: "${inputStr.substring(0, 50)}..."`, 'StringInputToolWrapper');
      } else {
        Logger.error(`ツール: ${this.name}, 入力タイプ: ${typeof inputStr}, 値: ${JSON.stringify(inputStr)}`, 'StringInputToolWrapper');
      }
      
      // エラーの種類に応じた詳細メッセージを追加
      let errorDetail = '';
      if (error.code) {
        errorDetail += ` (エラーコード: ${error.code})`;
      }
      if (error.cause) {
        errorDetail += ` (原因: ${error.cause instanceof Error ? error.cause.message : error.cause})`;
      }
      
      // エラーメッセージとともにフォールバック動作
      return `ツール入力解析エラー: ${error.message}${errorDetail}

このツールを使用するには、以下の形式でJSONオブジェクトが必要です:
${JSON.stringify(this.originalTool.schema.shape, null, 2)}

例えば、要件分析ツールでは次のようにしてください:
{
  "projectName": "プロジェクト名",
  "requirements": "要件の詳細説明"
}

もしくは、単に要件を直接入力することもできます。
例: カレンダーアプリを開発してください`;
    }
  }
  
  /**
   * 文字列をJSONに変換（柔軟なパースを試みる）
   * @param {string} input 
   * @returns {object}
   */
  _parseStringToJson(input) {
    // 文字列でない場合は変換（ただしnull, undefinedはそのまま）
    if (typeof input !== 'string') {
      if (input === null || input === undefined) {
        return input;
      }
      Logger.warn(`_parseStringToJson: 入力が文字列ではありません。型: ${typeof input}`, 'StringInputToolWrapper');
      
      // オブジェクトの場合はそのまま返す
      if (typeof input === 'object') {
        return input;
      }
      
      // 文字列に変換
      input = String(input);
    }
    
    // 空文字列の場合は空オブジェクトを返す
    if (!input || input.trim() === '') {
      Logger.warn('_parseStringToJson: 空の入力を受け取りました', 'StringInputToolWrapper');
      return {};
    }
    
    try {
      // まず通常のJSONパースを試みる
      try {
        const parsed = JSON.parse(input);
        Logger.debug('_parseStringToJson: 標準JSONパース成功', 'StringInputToolWrapper');
        return parsed;
      } catch (e) {
        Logger.debug(`_parseStringToJson: 標準JSONパース失敗: ${e.message}`, 'StringInputToolWrapper');
      }
      
      // クリーンアップ：入力文字列からバッククォートやコードブロック表記を削除
      let cleanedInput = input;
      
      // Markdownのコードブロック（```json〜```）を削除
      const codeBlockMatch = cleanedInput.match(/```(?:json)?(.+?)```/s);
      if (codeBlockMatch) {
        cleanedInput = codeBlockMatch[1].trim();
        Logger.debug('_parseStringToJson: Markdownコードブロックを検出し、内容を抽出しました', 'StringInputToolWrapper');
      }
      
      // バッククォートや前後の余分な記号を取り除く
      cleanedInput = cleanedInput.replace(/^[\s`'"]*/, '').replace(/[\s`'"]*$/, '');
      
      // シングルクォートをダブルクォートに置換（JSON規格はダブルクォートのみ）
      let jsonFixed = cleanedInput.replace(/'/g, '"');
      
      // プロパティ名のクォート修正（"name": → "name":）
      jsonFixed = jsonFixed.replace(/(\w+)(?=\s*:)/g, '"$1"');
      
      // 末尾のカンマを修正（JSON規格では配列やオブジェクトの最後の要素の後にカンマは許可されていない）
      jsonFixed = jsonFixed.replace(/,(\s*[}\]])/g, '$1');
      
      try {
        const parsedFixed = JSON.parse(jsonFixed);
        Logger.debug('_parseStringToJson: クリーンアップ後のJSONパース成功', 'StringInputToolWrapper');
        return parsedFixed;
      } catch (e) {
        Logger.debug(`_parseStringToJson: クリーンアップ後のJSONパース失敗: ${e.message}`, 'StringInputToolWrapper');
      }
      
      // キーバリュー形式のテキストを解析する試み
      // 例: folderType: requirements, fileName: requirements.md, content: ...
      try {
        const keyValueRegex = /(\w+)\s*:\s*([^,]+)(?:,|$)/g;
        const result = {};
        let match;
        
        while ((match = keyValueRegex.exec(input)) !== null) {
          const [, key, rawValue] = match;
          // 値を適切な型に変換する試み
          let value = rawValue.trim();
          
          // 真偽値の処理
          if (value.toLowerCase() === 'true') {
            value = true;
          } else if (value.toLowerCase() === 'false') {
            value = false;
          } 
          // 数値の処理
          else if (!isNaN(Number(value)) && value.trim() !== '') {
            value = Number(value);
          }
          // 文字列の場合、クォートを削除
          else if ((value.startsWith('"') && value.endsWith('"')) || 
                   (value.startsWith("'") && value.endsWith("'"))) {
            value = value.substring(1, value.length - 1);
          }
          
          result[key] = value;
        }
        
        // 有効な結果があるか確認
        if (Object.keys(result).length > 0) {
          Logger.debug('_parseStringToJson: キーバリュー形式のテキスト解析成功', 'StringInputToolWrapper');
          return result;
        }
      } catch (e) {
        Logger.debug(`_parseStringToJson: キーバリュー形式のテキスト解析失敗: ${e.message}`, 'StringInputToolWrapper');
      }
      
      // special case for RequirementAnalysisTool
      if (this.name === 'requirement_analysis' && input) {
        Logger.info('_parseStringToJson: RequirementAnalysisTool用の特別処理を適用します', 'StringInputToolWrapper');
        return {
          description: input
        };
      }
      
      // special case for ExternalDesignTool
      if (this.name === 'external_design' && input) {
        Logger.info('_parseStringToJson: ExternalDesignTool用の特別処理を適用します', 'StringInputToolWrapper');
        return {
          requirementsAnalysis: input
        };
      }
      
      // special case for SaveDocumentTool - contentを抽出
      if (this.name === 'save_document') {
        try {
          Logger.info(`SaveDocumentTool特別処理を開始: 入力=${input.substring(0, 100)}...`, 'StringInputToolWrapper');
          
          // まずJSONオブジェクトとしてパースを試みる
          try {
            const jsonObj = JSON.parse(input);
            if (jsonObj.content) {
              Logger.info('SaveDocumentTool: JSON形式として解析成功', 'StringInputToolWrapper');
              
              // デフォルト値の設定
              if (!jsonObj.folderType) {
                jsonObj.folderType = 'output';
                Logger.info('SaveDocumentTool: folderTypeが設定されていないため、デフォルト値"output"を使用', 'StringInputToolWrapper');
              }
              
              if (!jsonObj.fileName) {
                jsonObj.fileName = `document_${Date.now()}.md`;
                Logger.info(`SaveDocumentTool: fileNameが設定されていないため、デフォルト値"${jsonObj.fileName}"を使用`, 'StringInputToolWrapper');
              }
              
              return jsonObj;
            }
          } catch (e) {
            Logger.debug(`SaveDocumentTool: JSON解析失敗: ${e.message}`, 'StringInputToolWrapper');
            // JSON解析に失敗した場合は次の方法を試みる
          }

          // 正規表現による抽出を試みる
          Logger.info('SaveDocumentTool: 正規表現による解析を試みます', 'StringInputToolWrapper');
          const result = {
            folderType: 'output', // デフォルト値
            fileName: `document_${Date.now()}.md`, // デフォルト値
            content: ''
          };

          // content値を抽出する - より柔軟なパターン
          // 複数行のコンテンツを抽出するための正規表現
          const contentPatterns = [
            // content: "値" または content: '値' パターン
            /content\s*:\s*["']([^]*?)["'](?:,|\s*\}|\s*$)/,
            // content: 値 パターン（クォートなし、複数行）
            /content\s*:\s*([^,\}]+)(?:,|\s*\}|\s*$)/s,
            // ```によるコードブロック内のコンテンツ
            /```(?:markdown|md)?\s*([^`]+)```/s,
            // 残りの入力全体をコンテンツとして扱う
            /(.+)/s
          ];

          // 各パターンを順番に試す
          let content = '';
          for (const pattern of contentPatterns) {
            const match = input.match(pattern);
            if (match) {
              content = match[1].trim();
              Logger.info(`SaveDocumentTool: コンテンツ抽出成功 - パターン: ${pattern}`, 'StringInputToolWrapper');
              break;
            }
          }

          if (content) {
            result.content = content;
          } else {
            // contentが見つからない場合は入力全体をcontentとして扱う
            Logger.warn('SaveDocumentTool: コンテンツ抽出失敗、入力全体をコンテンツとして使用', 'StringInputToolWrapper');
            result.content = input;
          }

          // その他のパラメータを抽出
          const folderTypeMatch = input.match(/folderType\s*:\s*["']?([^"',\}]+)["']?/);
          const fileNameMatch = input.match(/fileName\s*:\s*["']?([^"',\}]+)["']?/);
          const overwriteMatch = input.match(/overwrite\s*:\s*(true|false)/i);

          if (folderTypeMatch) {
            result.folderType = folderTypeMatch[1].trim();
          }

          if (fileNameMatch) {
            result.fileName = fileNameMatch[1].trim();
          }

          if (overwriteMatch) {
            result.overwrite = overwriteMatch[1].toLowerCase() === 'true';
          }

          // 解析結果を検証
          if (!result.content || result.content.trim() === '') {
            Logger.error('SaveDocumentTool: コンテンツが空です', 'StringInputToolWrapper');
            throw new Error('ドキュメント保存に失敗: コンテンツが空です');
          }

          Logger.info(`SaveDocumentTool: 解析結果: folderType=${result.folderType}, fileName=${result.fileName}, content長=${result.content.length}文字`, 'StringInputToolWrapper');
          return result;
        } catch (e) {
          Logger.error(`SaveDocumentTool: 入力解析エラー: ${e.message}`, 'StringInputToolWrapper');
          throw new Error(`SaveDocumentToolの入力解析に失敗しました: ${e.message}\n\n正しいフォーマットは次の通りです：\n{
  "folderType": "output", 
  "fileName": "example.md", 
  "content": "ドキュメント内容"
}`);
        }
      }

      // すべての解析方法が失敗した場合、元の入力を文字列としてラップして返す
      Logger.warn('_parseStringToJson: すべての解析方法が失敗しました。入力をそのまま文字列として使用します', 'StringInputToolWrapper');
      return { input };
    } catch (error) {
      Logger.error(`_parseStringToJson: 予期しないエラー: ${error.message}`, 'StringInputToolWrapper');
      // エラーが発生した場合は空のオブジェクトを返す
      return {};
    }
  }
}

export default ReActToolAdapter; 