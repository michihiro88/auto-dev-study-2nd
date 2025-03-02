/**
 * 要件分析と外部設計のためのツールセット
 */
import fs from 'fs-extra';
import path from 'path';
import { StructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import config from '../config/index.js';
import Logger from '../utils/logger.js';
import { getFormattedDateTime, getTimestampedFilename } from '../utils/formatter.js';

/**
 * 要件分析ツール - ユーザーの入力から要件を分析する
 */
class RequirementAnalysisTool extends StructuredTool {
  constructor() {
    super();
    this.name = "requirement_analysis";
    this.description = "与えられた情報から要件を分析し、構造化された要件分析ドキュメントを生成します。";
    
    // 文字列の入力も受け付けるスキーマに修正
    this.schema = z.union([
      // オプション1: 構造化された入力
      z.object({
        projectName: z.string().describe("プロジェクト名"),
        description: z.string().describe("要件の説明"),
      }),
      // オプション2: 単純な文字列入力
      z.string().describe("要件の説明"),
    ]);
  }

  async _call(input) {
    try {
      // 入力が文字列か構造化データかを判定
      let projectName, description;
      
      if (typeof input === 'string') {
        // 文字列の場合はそのまま説明として扱う
        description = input;
        // プロジェクト名にデフォルト接頭辞を付けて一意に
        projectName = `proj_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}_${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
        Logger.info(`文字列入力を受け取りました: "${description.substring(0, 50)}${description.length > 50 ? '...' : ''}"`, 'RequirementAnalysisTool');
      } else if (typeof input === 'object' && input !== null) {
        // 構造化データの場合はプロパティを展開
        ({ projectName, description } = input);
        
        // プロジェクト名が指定されていない場合はデフォルト値を設定
        if (!projectName) {
          projectName = `proj_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}_${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
        }
        
        // descriptionが文字列でない場合は変換
        if (typeof description !== 'string') {
          Logger.warn(`description が文字列ではありません。型: ${typeof description}`, 'RequirementAnalysisTool');
          description = typeof description === 'object' ? JSON.stringify(description) : String(description || '');
        }
      } else {
        // その他の型の場合は文字列に変換
        description = String(input || '');
        projectName = `proj_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}_${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
        Logger.warn(`予期しない入力型: ${typeof input}, 文字列に変換します`, 'RequirementAnalysisTool');
      }
      
      Logger.info(`要件分析を実行: ${projectName}`, 'RequirementAnalysisTool');

      // 出力用フォルダのパスを取得
      const outputDir = config.app.outputDirs.requirements;
      
      // 要件分析結果を保存するファイル名
      const filename = getTimestampedFilename(`${projectName.replace(/\s+/g, '_')}_requirements`, 'md');
      const filePath = path.join(outputDir, filename);
      
      // パスの表示を統一するために、すべてのバックスラッシュをスラッシュに変換
      const displayPath = filePath.replace(/\\/g, '/');
      
      // 実際にファイルを生成（事前に内容を保存しておく）
      try {
        // この時点では要件分析はまだ行われていないので、一時的な内容を生成
        // AIのアシスタントがこれから要件分析を実行する
        const content = `# ${projectName} - 要件定義書

## プロジェクト概要
${description}

## 分析すべき要素
- 機能要件の詳細
- 非機能要件の特定
- ユーザーストーリー
- 優先度

このドキュメントはAIアシスタントによる要件分析が必要です。AIアシスタントがこの後、詳細な要件分析を実施します。`;

        // ファイルを保存
        fs.ensureDirSync(outputDir);
        fs.writeFileSync(filePath, content, 'utf8');
        Logger.info(`要件分析の初期ファイルを保存しました: ${filePath}`, 'RequirementAnalysisTool');
      } catch (fileError) {
        Logger.error(`ファイル保存エラー: ${fileError.message}`, 'RequirementAnalysisTool');
        // エラーはスローせず、処理を続行
      }
      
      // 応答メッセージ - AIエージェントに要件分析と保存を促す指示を追加
      return `プロジェクト「${projectName}」の要件「${description}」の分析を開始します。分析結果は${displayPath}に保存されます。この後、詳細な要件分析を実施し、save_documentツールを使用して保存してください。`;
    } catch (error) {
      Logger.error(`要件分析エラー: ${error.message}`, 'RequirementAnalysisTool');
      throw new Error(`要件分析中にエラーが発生しました: ${error.message}`);
    }
  }
}

/**
 * 外部設計ツール - 要件分析をもとに外部設計を行う
 */
class ExternalDesignTool extends StructuredTool {
  constructor() {
    super();
    this.name = "external_design";
    this.description = "要件分析をもとに外部設計を行い、設計ドキュメントを生成します。";
    
    // 文字列の入力も受け付けるスキーマに修正
    this.schema = z.union([
      // オプション1: 構造化された入力
      z.object({
        projectName: z.string().describe("プロジェクト名"),
        requirementsAnalysis: z.string().describe("要件分析の結果や要件の説明"),
        includeArchitecture: z.boolean().optional().describe("アーキテクチャ設計を含めるか"),
        includeUML: z.boolean().optional().describe("UMLダイアグラムを含めるか"),
      }),
      // オプション2: 単純な文字列入力
      z.string().describe("外部設計を行うための要件や分析の説明"),
    ]);
  }

  async _call(input) {
    try {
      // 入力が文字列か構造化データかを判定
      let projectName, requirementsAnalysis, includeArchitecture, includeUML;
      
      if (typeof input === 'string') {
        // 文字列の場合はそのまま要件分析として扱う
        requirementsAnalysis = input;
        // プロジェクト名にデフォルト接頭辞を付けて一意に
        projectName = `proj_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}_${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
        includeArchitecture = true;
        includeUML = true;
        Logger.info(`文字列入力を受け取りました: "${requirementsAnalysis.substring(0, 50)}${requirementsAnalysis.length > 50 ? '...' : ''}"`, 'ExternalDesignTool');
      } else if (typeof input === 'object' && input !== null) {
        // 構造化データの場合はプロパティを展開
        ({ projectName, requirementsAnalysis, includeArchitecture = true, includeUML = true } = input);
        
        // プロジェクト名が指定されていない場合はデフォルト値を設定
        if (!projectName) {
          projectName = `proj_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}_${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
        }
        
        // requirementsAnalysisが文字列でない場合は変換
        if (typeof requirementsAnalysis !== 'string') {
          Logger.warn(`requirementsAnalysis が文字列ではありません。型: ${typeof requirementsAnalysis}`, 'ExternalDesignTool');
          requirementsAnalysis = typeof requirementsAnalysis === 'object' ? JSON.stringify(requirementsAnalysis) : String(requirementsAnalysis || '');
        }
      } else {
        // その他の型の場合は文字列に変換
        requirementsAnalysis = String(input || '');
        projectName = `proj_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}_${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
        includeArchitecture = true;
        includeUML = true;
        Logger.warn(`予期しない入力型: ${typeof input}, 文字列に変換します`, 'ExternalDesignTool');
      }
      
      Logger.info(`外部設計を実行: ${projectName}`, 'ExternalDesignTool');

      // 出力用フォルダのパスを取得
      const outputDir = config.app.outputDirs.designs;
      
      // 設計結果を保存するファイル名
      const filename = getTimestampedFilename(`${projectName.replace(/\s+/g, '_')}_design`, 'md');
      const filePath = path.join(outputDir, filename);
      
      // パスの表示を統一するために、すべてのバックスラッシュをスラッシュに変換
      const displayPath = filePath.replace(/\\/g, '/');
      
      // 実際にファイルを生成（事前に内容を保存しておく）
      try {
        // この時点では外部設計はまだ行われていないので、一時的な内容を生成
        // AIのアシスタントがこれから外部設計を実行する
        const content = `# ${projectName} - 外部設計書

## 元となる要件
${requirementsAnalysis}

## 必要な設計要素
${includeArchitecture ? '- システムアーキテクチャの設計' : ''}
${includeUML ? '- UMLダイアグラムの作成' : ''}
- 画面レイアウトの設計
- コンポーネント構成の設計

このドキュメントはAIアシスタントによる外部設計が必要です。AIアシスタントがこの後、詳細な外部設計を実施します。`;

        // ファイルを保存
        fs.ensureDirSync(outputDir);
        fs.writeFileSync(filePath, content, 'utf8');
        Logger.info(`外部設計の初期ファイルを保存しました: ${filePath}`, 'ExternalDesignTool');
      } catch (fileError) {
        Logger.error(`ファイル保存エラー: ${fileError.message}`, 'ExternalDesignTool');
        // エラーはスローせず、処理を続行
      }
      
      // 応答メッセージ - AIエージェントに設計と保存を促す指示を追加
      return `要件「${requirementsAnalysis}」の外部設計を開始します。設計結果は${displayPath}に保存されます。この後、詳細な外部設計を実施し、save_documentツールを使用して保存してください。${includeUML ? 'UMLダイアグラムも作成してください。' : ''}`;
    } catch (error) {
      Logger.error(`外部設計エラー: ${error.message}`, 'ExternalDesignTool');
      throw new Error(`外部設計中にエラーが発生しました: ${error.message}`);
    }
  }
}

/**
 * ドキュメント保存ツール - 生成したドキュメントをファイルに保存する
 */
class SaveDocumentTool extends StructuredTool {
  constructor() {
    super();
    this.name = "save_document";
    this.description = "ドキュメントをファイルに保存します。";
    this.schema = z.object({
      folderType: z.enum(["requirements", "designs", "output"]).describe("保存先フォルダの種類"),
      fileName: z.string().describe("保存するファイル名（拡張子含む）"),
      content: z.string().describe("保存するファイルの内容"),
      overwrite: z.boolean().optional().describe("既存ファイルを上書きする場合はtrue"),
    });
  }

  async _call(args) {
    try {
      Logger.info(`ドキュメント保存開始: 引数=${JSON.stringify(args)}`, 'SaveDocumentTool');
      
      // 引数の検証と初期化
      if (!args) {
        const errorMessage = '引数が未定義または空です';
        Logger.error(errorMessage, 'SaveDocumentTool');
        throw new Error(errorMessage);
      }
      
      let { folderType, fileName, content, overwrite = false } = args;
      
      // 必須パラメータの検証
      if (!folderType) {
        Logger.warn('folderTypeが指定されていません。デフォルト値"output"を使用します', 'SaveDocumentTool');
        folderType = "output";
      }
      
      if (!fileName) {
        Logger.warn('fileNameが指定されていません。デフォルト値を生成します', 'SaveDocumentTool');
        fileName = `document_${Date.now()}.md`;
      }
      
      if (!content) {
        const errorMessage = 'contentが未定義または空です';
        Logger.error(errorMessage, 'SaveDocumentTool');
        throw new Error(errorMessage);
      }

      Logger.info(`ドキュメント保存開始: ${folderType}/${fileName}`, 'SaveDocumentTool');

      // フォルダパスの取得
      let outputDir;
      switch (folderType) {
        case "requirements":
          outputDir = config.app.outputDirs.requirements;
          break;
        case "designs":
          outputDir = config.app.outputDirs.designs;
          break;
        default:
          outputDir = config.app.outputDirs.output;
      }

      // config.app.outputDirsが適切に設定されていることを確認
      if (!outputDir) {
        const errorMessage = `出力ディレクトリが設定されていません: ${folderType}`;
        Logger.error(errorMessage, 'SaveDocumentTool');
        throw new Error(errorMessage);
      }

      // ファイルパスの構築
      Logger.debug(`ファイルパス構築: outputDir=${outputDir}, fileName=${fileName}`, 'SaveDocumentTool');
      const filePath = path.join(outputDir, fileName);
      
      if (!filePath) {
        const errorMessage = `ファイルパスの生成に失敗しました: outputDir=${outputDir}, fileName=${fileName}`;
        Logger.error(errorMessage, 'SaveDocumentTool');
        throw new Error(errorMessage);
      }
      
      const displayPath = filePath.replace(/\\/g, '/');

      // ディレクトリが存在することを確認
      try {
        fs.ensureDirSync(outputDir);
      } catch (dirError) {
        Logger.error(`ディレクトリ作成エラー: ${dirError.message}`, 'SaveDocumentTool');
        throw new Error(`ディレクトリ作成中にエラーが発生しました: ${dirError.message}`);
      }

      // ファイルの存在チェック
      const fileExists = fs.existsSync(filePath);

      if (fileExists && !overwrite) {
        Logger.warn(`ファイルが既に存在し、上書きが許可されていません: ${filePath}`, 'SaveDocumentTool');
        return `ファイル ${displayPath} は既に存在し、上書きオプションが指定されていなかったため保存できませんでした。上書きする場合は overwrite: true を指定してください。`;
      }

      // ファイル保存
      try {
        fs.writeFileSync(filePath, content, 'utf8');
      } catch (writeError) {
        Logger.error(`ファイル書き込みエラー: ${writeError.message}`, 'SaveDocumentTool');
        throw new Error(`ファイル書き込み中にエラーが発生しました: ${writeError.message}`);
      }

      Logger.info(`ドキュメントを保存しました: ${filePath}`, 'SaveDocumentTool');
      return `ドキュメントが ${displayPath} に${fileExists ? '上書き' : ''}保存されました。${fileExists ? '（既存ファイルを上書きしました）' : ''}`;
    } catch (error) {
      Logger.error(`ドキュメント保存エラー: ${error.message}`, 'SaveDocumentTool');
      throw new Error(`ドキュメントの保存中にエラーが発生しました: ${error.message}`);
    }
  }
}

/**
 * UML生成ツール - UMLダイアグラムをMermaid記法で生成する
 */
class UMLGeneratorTool extends StructuredTool {
  constructor() {
    super();
    this.name = "generate_uml";
    this.description = "UMLダイアグラムをMermaid記法で生成します。";
    this.schema = z.object({
      type: z.enum(["class", "sequence", "usecase", "entity", "component"]).describe("UMLの種類"),
      description: z.string().describe("UMLの説明（何を表現するか）"),
      details: z.string().optional().describe("UMLの詳細情報"),
    });
  }

  async _call({ type, description, details = '' }) {
    try {
      Logger.info(`UML生成を実行: ${type} - ${description}`, 'UMLGeneratorTool');
      
      // この時点では実際のUMLは生成されないので、入力情報を返す
      // 実際のUML生成はReActエージェントが行う
      let response = `${type}ダイアグラムの生成を開始します: ${description}`;
      if (details) {
        response += `\n詳細情報: ${details.substring(0, 100)}${details.length > 100 ? '...' : ''}`;
      }
      
      return response;
    } catch (error) {
      Logger.error(`UML生成エラー: ${error.message}`, 'UMLGeneratorTool');
      throw new Error(`UML生成中にエラーが発生しました: ${error.message}`);
    }
  }
}

/**
 * 画面レイアウトツール - 画面レイアウトをテキストで表現する
 */
class LayoutGeneratorTool extends StructuredTool {
  constructor() {
    super();
    this.name = "generate_layout";
    this.description = "画面レイアウトをテキストで表現します。";
    this.schema = z.object({
      screenName: z.string().describe("画面名"),
      description: z.string().describe("画面の説明と要件"),
      format: z.enum(["ascii", "markdown", "html"]).optional().describe("出力形式（デフォルトはmarkdown）"),
    });
  }

  async _call({ screenName, description, format = "markdown" }) {
    try {
      Logger.info(`画面レイアウト生成: ${screenName}`, 'LayoutGeneratorTool');
      
      // この時点では実際のレイアウトは生成されないので、入力情報を返す
      // 実際のレイアウト生成はReActエージェントが行う
      return `${screenName}の画面レイアウト生成を${format}形式で開始します: ${description.substring(0, 100)}${description.length > 100 ? '...' : ''}`;
    } catch (error) {
      Logger.error(`画面レイアウト生成エラー: ${error.message}`, 'LayoutGeneratorTool');
      throw new Error(`画面レイアウト生成中にエラーが発生しました: ${error.message}`);
    }
  }
}

// ツールのエクスポート
export const requirementAnalysisTool = new RequirementAnalysisTool();
export const externalDesignTool = new ExternalDesignTool();
export const saveDocumentTool = new SaveDocumentTool();
export const umlGeneratorTool = new UMLGeneratorTool();
export const layoutGeneratorTool = new LayoutGeneratorTool();

// 全ツールをまとめたリスト
export const analysisTools = [
  requirementAnalysisTool,
  externalDesignTool,
  saveDocumentTool,
  umlGeneratorTool,
  layoutGeneratorTool
]; 