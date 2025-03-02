# ReAct エージェント

LangChain v0.3 を使用した要件分析・外部設計支援ツール

## 概要

このプロジェクトは、最新の LangChain v0.3 フレームワークを活用した ReAct (Reasoning + Acting) エージェントを実装したものです。複数のAIモデル（OpenAI、Anthropic Claude、Google Gemini、DeepSeek）をサポートし、要件分析や外部設計などのソフトウェア開発初期段階の作業を支援します。

## 機能

- **複数のAIモデル対応**
  - OpenAI GPT-3.5/GPT-4
  - Anthropic Claude
  - Google Gemini
  - DeepSeek
  - ローカルモデル（DeepSeek用にOllamaをサポート）

- **要件分析・外部設計支援**
  - 要件の構造化と分析
  - 外部設計ドキュメントの生成
  - UMLダイアグラム作成（Mermaid記法）
  - 画面レイアウト設計

- **便利なインターフェース**
  - コマンドラインインターフェース（CLI）
  - インタラクティブモード
  - セッション管理と保存機能

## インストール

### 前提条件

- Node.js 18.0.0 以上
- npm 9.0.0 以上

### セットアップ手順

1. リポジトリをクローンするか、ファイルをダウンロードします

2. 依存パッケージをインストールします
   ```bash
   cd FifthStudy
   npm install
   ```

3. 環境設定ファイルを作成します
   ```bash
   # .env.exampleをコピーして.envファイルを作成
   Copy-Item .env.example .env
   ```

4. `.env`ファイルを編集して、各AIプロバイダのAPIキーを設定します
   ```
   # 使用するモデルのAPIキーを設定してください
   OPENAI_API_KEY=your_openai_api_key
   ANTHROPIC_API_KEY=your_anthropic_api_key
   GOOGLE_API_KEY=your_google_api_key
   DEEPSEEK_API_KEY=your_deepseek_api_key
   ```

## 使い方

### インタラクティブモードの起動

```bash
npm start
# または
node src/index.js
```

### コマンドラインオプション

```bash
# ヘルプを表示
node src/index.js --help

# モデル一覧の表示
node src/index.js list-models

# エージェントのステータス表示
node src/index.js status

# 要件分析の実行
node src/index.js analyze
```

### 基本的な操作フロー

1. アプリケーションを起動する
2. 使用するAIモデルを選択する（デフォルトはOpenAI GPT-3.5-turbo）
3. 「要件分析・外部設計を行う」を選択し、プロジェクト名と要件を入力
4. 分析結果を確認し、必要に応じてファイルに保存

## 出力ファイル

分析結果やセッション記録は以下のディレクトリに保存されます：

- 要件分析: `output/requirements/`
- 外部設計: `output/designs/`
- セッション記録: `output/sessions/`
- ログファイル: `logs/`

## トラブルシューティング

### APIキーが認識されない場合

- `.env`ファイルが正しい場所に作成されているか確認してください
- APIキーが正しいフォーマットで入力されているか確認してください

### モデルが利用できないエラーが出る場合

- 指定したモデルのAPIキーが設定されているか確認してください
- インターネット接続を確認してください
- ローカルモデル（Ollama）を使用する場合は、Ollamaが起動しているか確認してください

### Azure OpenAI API関連のエラーが発生する場合

エラーメッセージ「Azure OpenAI API instance name not found」が表示される場合：

- このエラーはLangChain v0.3.17の`@langchain/openai`パッケージの挙動によるものです
- このパッケージは特定の条件下で自動的にAzure OpenAI APIを使用しようとしますが、Azure APIに必要な設定が見つからない場合にこのエラーが発生します
- 解決方法：
  1. `.env`ファイルで`DEFAULT_MODEL`を`gpt-3.5-turbo`に設定する
  2. OpenAI社の標準APIキーを`.env`ファイルの`OPENAI_API_KEY`に正しく設定する
  3. 問題が続く場合は、依存パッケージを最新版に更新してみる: `npm update @langchain/openai`

### その他の一般的な問題

- Node.jsのバージョンが18.0.0以上であることを確認してください
- 依存パッケージが正しくインストールされているか確認してください：`npm install`を実行
- コンソールにエラーメッセージが表示されている場合は、`logs`ディレクトリ内のログファイルで詳細な情報を確認できます

## ライセンス

MIT License 