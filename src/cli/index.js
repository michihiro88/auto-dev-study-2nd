import fs from 'fs-extra';

/**
 * CLIインターフェース
 * コマンドラインからReActエージェントを操作するためのインターフェース
 */
import { Command } from 'commander';
import prompts from 'prompts';
import chalk from 'chalk';
import config from '../config/index.js';
import agentController from '../controllers/agent-controller.js';
import Logger from '../utils/logger.js';
import { getFormattedDateTime } from '../utils/formatter.js';

// バナーの表示
const showBanner = () => {
  console.log(chalk.cyan('------------------------------------------------'));
  console.log(chalk.cyan(`
  ReAct エージェント v${config.app.version}
  LangChain v0.3を使用した要件分析・外部設計ツール
  `));
  console.log(chalk.cyan('------------------------------------------------'));
};

// モデル一覧の表示
const listModels = async () => {
  const models = agentController.getAvailableModels();
  const currentModel = agentController.getCurrentModelInfo();
  
  console.log(chalk.cyan('\n利用可能なモデル:'));
  
  for (const modelName of models) {
    const isCurrent = modelName === currentModel.name;
    const modelInfo = config.models.availableModels[modelName];
    const providerName = config.models.modelProviders[modelInfo.provider];
    
    if (isCurrent) {
      console.log(chalk.green(`* ${modelName} (${providerName}) [現在選択中]`));
    } else {
      console.log(`  ${modelName} (${providerName})`);
    }
  }
  
  console.log('');
};

// モデルの変更
const changeModel = async () => {
  const models = agentController.getAvailableModels();
  
  const response = await prompts({
    type: 'select',
    name: 'selectedModel',
    message: '使用するモデルを選択してください:',
    choices: models.map(model => ({ title: model, value: model })),
    initial: 0
  }, {
    onCancel: () => {
      console.log(chalk.yellow('モデル選択をキャンセルしました'));
      return { selectedModel: null };
    }
  });
  
  if (!response.selectedModel) return;
  
  try {
    await agentController.changeModel(response.selectedModel);
    console.log(chalk.green(`モデルを ${response.selectedModel} に変更しました`));
  } catch (error) {
    console.error(chalk.red(`モデルの変更に失敗しました: ${error.message}`));
  }
};

// エージェントのステータス表示
const showStatus = async () => {
  const status = agentController.getStatus();
  const currentModel = agentController.getCurrentModelInfo();
  
  console.log(chalk.cyan('\nエージェントの状態:'));
  console.log(`初期化済み: ${status.initialized ? '✓' : '✗'}`);
  console.log(`現在のモデル: ${currentModel.displayName}`);
  console.log(`アクティブセッション: ${status.hasActiveSession ? '✓' : '✗'}`);
  console.log(`セッション数: ${status.sessionCount}`);
  console.log('');
};

// インタラクティブモード
const interactiveMode = async () => {
  showBanner();
  
  // エージェントの初期化
  try {
    console.log(chalk.yellow('エージェントを初期化しています...'));
    await agentController.initialize();
    console.log(chalk.green('エージェントの初期化が完了しました'));
  } catch (error) {
    console.error(chalk.red(`エージェントの初期化に失敗しました: ${error.message}`));
    return;
  }
  
  // 現在のモデル情報を表示
  const currentModel = agentController.getCurrentModelInfo();
  console.log(chalk.green(`現在のモデル: ${currentModel.displayName}`));
  
  let running = true;
  
  while (running) {
    const response = await prompts({
      type: 'select',
      name: 'action',
      message: '操作を選択してください:',
      choices: [
        { title: '要件分析・外部設計を行う', value: 'analyze' },
        { title: 'モデルを変更する', value: 'change_model' },
        { title: 'ステータスを表示する', value: 'status' },
        { title: 'モデル一覧を表示する', value: 'list_models' },
        { title: '終了する', value: 'exit' }
      ],
      initial: 0
    }, {
      onCancel: () => {
        console.log(chalk.yellow('操作をキャンセルしました'));
        return { action: null };
      }
    });
    
    if (!response.action) continue;
    
    switch (response.action) {
      case 'analyze':
        await runAnalysis();
        break;
      
      case 'change_model':
        await changeModel();
        break;
      
      case 'status':
        await showStatus();
        break;
      
      case 'list_models':
        await listModels();
        break;
      
      case 'exit':
        console.log(chalk.yellow('セッションを保存しています...'));
        try {
          const filePath = await agentController.saveSession();
          console.log(chalk.green(`セッションを保存しました: ${filePath}`));
        } catch (error) {
          console.error(chalk.red(`セッションの保存に失敗しました: ${error.message}`));
        }
        
        console.log(chalk.yellow('終了します。お疲れ様でした！'));
        running = false;
        break;
    }
  }
};

// 要件分析・外部設計の実行
const runAnalysis = async () => {
  // プロジェクト情報の入力
  const projectResponse = await prompts({
    type: 'text',
    name: 'projectName',
    message: 'プロジェクト名を入力してください:',
    initial: `Project_${getFormattedDateTime()}`
  }, {
    onCancel: () => {
      console.log(chalk.yellow('プロジェクト名の入力をキャンセルしました'));
      return { projectName: null };
    }
  });
  
  if (!projectResponse.projectName) return;
  
  const requirementsResponse = await prompts({
    type: 'text',
    name: 'requirements',
    message: '要件を入力してください（複数行の場合は\\nで改行を表現できます）:',
    validate: input => input && input.trim() ? true : '要件を入力してください'
  }, {
    onCancel: () => {
      console.log(chalk.yellow('要件の入力をキャンセルしました'));
      return { requirements: null };
    }
  });
  
  if (!requirementsResponse.requirements) return;
  
  // 入力された要件を改行で正しく表示
  const formattedRequirements = requirementsResponse.requirements.replace(/\\n/g, '\n');
  
  console.log(chalk.cyan('\n入力された要件:'));
  console.log(formattedRequirements);
  
  // 要件の確認
  const confirmResponse = await prompts({
    type: 'confirm',
    name: 'confirmed',
    message: 'この要件で分析を開始しますか？',
    initial: true
  }, {
    onCancel: () => {
      console.log(chalk.yellow('要件の確認をキャンセルしました'));
      return { confirmed: false };
    }
  });
  
  if (!confirmResponse.confirmed) {
    console.log(chalk.yellow('要件分析をキャンセルしました'));
    return;
  }
  
  console.log(chalk.yellow('\n要件分析を開始します...'));
  
  try {
    // エージェントに要件を処理させる
    const inputPrompt = `以下の要件について分析し、適切な外部設計を提案してください:\n\n${formattedRequirements}`;
    Logger.info(`エージェントへの入力: ${inputPrompt.substring(0, 100)}...`, 'CLI');
    
    const result = await agentController.processInput(inputPrompt);
    
    console.log(chalk.green('\n要件分析が完了しました。\n'));
    console.log(chalk.cyan('----------------------------------------'));
    console.log(result.output);
    console.log(chalk.cyan('----------------------------------------'));
    
    // 分析結果のファイル出力結果を確認
    const requirementsDir = config.app.outputDirs.requirements;
    const designsDir = config.app.outputDirs.designs;
    
    // requirementsディレクトリのファイル一覧を取得
    let requirementsFiles = [];
    try {
      requirementsFiles = await fs.readdir(requirementsDir);
      requirementsFiles = requirementsFiles.filter(file => 
        file.endsWith('.md') || file.endsWith('.json')
      );
    } catch (error) {
      console.log(chalk.yellow(`要件分析結果ディレクトリの読み取りに失敗しました: ${error.message}`));
    }
    
    // designsディレクトリのファイル一覧を取得
    let designsFiles = [];
    try {
      designsFiles = await fs.readdir(designsDir);
      designsFiles = designsFiles.filter(file => 
        file.endsWith('.md') || file.endsWith('.json')
      );
    } catch (error) {
      console.log(chalk.yellow(`外部設計結果ディレクトリの読み取りに失敗しました: ${error.message}`));
    }
    
    // 分析結果ファイルが存在するかどうかを表示
    if (requirementsFiles.length > 0) {
      console.log(chalk.green(`✓ 要件分析結果が保存されました: ${requirementsDir}`));
      requirementsFiles.forEach(file => {
        console.log(chalk.green(`  - ${file}`));
      });
    } else {
      console.log(chalk.yellow(`! 要件分析結果ファイルが見つかりません。保存されていない可能性があります。`));
    }
    
    if (designsFiles.length > 0) {
      console.log(chalk.green(`✓ 外部設計結果が保存されました: ${designsDir}`));
      designsFiles.forEach(file => {
        console.log(chalk.green(`  - ${file}`));
      });
    } else {
      console.log(chalk.yellow(`! 外部設計結果ファイルが見つかりません。保存されていない可能性があります。`));
    }
    
    // セッション保存の確認
    const saveResponse = await prompts({
      type: 'confirm',
      name: 'saveToFile',
      message: '分析結果をファイルに保存しますか？',
      initial: true
    }, {
      onCancel: () => {
        console.log(chalk.yellow('保存の確認をキャンセルしました'));
        return { saveToFile: false };
      }
    });
    
    if (saveResponse.saveToFile) {
      try {
        const filePath = await agentController.saveSession();
        console.log(chalk.green(`セッションを保存しました: ${filePath}`));
      } catch (error) {
        console.error(chalk.red(`セッションの保存に失敗しました: ${error.message}`));
      }
    }
  } catch (error) {
    console.error(chalk.red(`要件分析中にエラーが発生しました: ${error.message}`));
  }
};

// コマンドラインの定義
const cli = new Command();

cli
  .name('react-agent')
  .description('LangChain v0.3を使用したReActエージェントによる要件分析・外部設計ツール')
  .version(config.app.version);

// インタラクティブモードコマンド
cli
  .command('interactive')
  .alias('i')
  .description('インタラクティブモードでエージェントを起動')
  .action(() => {
    interactiveMode().catch(err => {
      console.error(chalk.red(`エラーが発生しました: ${err.message}`));
      process.exit(1);
    });
  });

// モデル一覧コマンド
cli
  .command('list-models')
  .alias('ls')
  .description('利用可能なモデル一覧を表示')
  .action(async () => {
    try {
      // エージェントが初期化されていない場合は初期化
      if (!agentController.getStatus().initialized) {
        await agentController.initialize();
      }
      await listModels();
    } catch (err) {
      console.error(chalk.red(`エラーが発生しました: ${err.message}`));
      process.exit(1);
    }
  });

// ステータス表示コマンド
cli
  .command('status')
  .description('エージェントの状態を表示')
  .action(async () => {
    try {
      // エージェントが初期化されていない場合は初期化
      if (!agentController.getStatus().initialized) {
        await agentController.initialize();
      }
      await showStatus();
    } catch (err) {
      console.error(chalk.red(`エラーが発生しました: ${err.message}`));
      process.exit(1);
    }
  });

// 要件分析コマンド
cli
  .command('analyze')
  .description('要件分析と外部設計を実行')
  .action(() => {
    // エージェントの初期化
    agentController.initialize()
      .then(() => runAnalysis())
      .catch(err => {
        console.error(chalk.red(`エラーが発生しました: ${err.message}`));
        process.exit(1);
      });
  });

// エクスポート
export default cli; 