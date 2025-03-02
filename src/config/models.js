/**
 * AI言語モデルの設定ファイル
 */

// デフォルトのモデル
export const defaultModel = process.env.DEFAULT_MODEL || 'gpt-3.5-turbo';

// 利用可能なモデル定義
export const availableModels = {
  // OpenAIモデル
  'gpt-3.5-turbo': {
    provider: 'openai',
    options: {
      model: 'gpt-3.5-turbo',
      temperature: 0.7,
      maxTokens: 4096
    }
  },
  'gpt-4-turbo': {
    provider: 'openai',
    options: {
      model: 'gpt-4-turbo',
      temperature: 0.7,
      maxTokens: 4096
    }
  },
  'gpt-4o': {
    provider: 'openai',
    options: {
      model: 'gpt-4o',
      temperature: 0.7,
      maxTokens: 4096
    }
  },
  'gpt-4o-mini': {
    provider: 'openai',
    options: {
      model: 'gpt-4o-mini',
      temperature: 0.7,
      maxTokens: 4096
    }
  },
  
  // Geminiモデル
  'gemini-2.0-flash': {
    provider: 'gemini',
    options: {
      model: 'gemini-2.0-flash',
      temperature: 0.7,
      maxOutputTokens: 4096
    }
  },
  'gemini-1.5-flash': {
    provider: 'gemini',
    options: {
      model: 'gemini-1.5-flash',
      temperature: 0.7,
      maxOutputTokens: 4096
    }
  },
  'gemini-1.5-pro': {
    provider: 'gemini',
    options: {
      model: 'gemini-1.5-pro',
      temperature: 0.7,
      maxOutputTokens: 4096
    }
  },
  
  // Claudeモデル
  'claude-3-5-sonnet-20241022': {
    provider: 'anthropic',
    options: {
      model: 'claude-3-5-sonnet-20241022',
      temperature: 0.7,
      maxTokens: 4096
    }
  },
  'claude-3-5-haiku-20241022': {
    provider: 'anthropic',
    options: {
      model: 'claude-3-5-haiku-20241022',
      temperature: 0.7,
      maxTokens: 4096
    }
  },
  'claude-3-opus-20240229': {
    provider: 'anthropic',
    options: {
      model: 'claude-3-opus-20240229',
      temperature: 0.7,
      maxTokens: 4096
    }
  },
  
  // DeepSeekモデル
  'deepseek-chat': {
    provider: 'deepseek',
    options: {
      model: 'deepseek-chat',
      temperature: 0.7,
      maxTokens: 4096
    }
  }
};

// モデルのプロバイダーごとの識別子
export const modelProviders = {
  openai: 'OpenAI',
  anthropic: 'Anthropic Claude',
  gemini: 'Google Gemini',
  deepseek: 'DeepSeek'
};

/**
 * モデル名が有効かチェックする
 * @param {string} modelName - チェックするモデル名
 * @returns {boolean} モデルが存在するかどうか
 */
export const isValidModel = (modelName) => {
  return Object.keys(availableModels).includes(modelName);
};

/**
 * モデルのプロバイダーを取得する
 * @param {string} modelName - モデル名
 * @returns {string|null} プロバイダー名、無効なモデルの場合はnull
 */
export const getModelProvider = (modelName) => {
  if (!isValidModel(modelName)) return null;
  return availableModels[modelName].provider;
};

/**
 * モデルの表示名を取得する
 * @param {string} modelName - モデル名
 * @returns {string} モデルの表示名
 */
export const getModelDisplayName = (modelName) => {
  if (!isValidModel(modelName)) return 'Unknown Model';
  const provider = modelProviders[availableModels[modelName].provider];
  return `${provider} (${modelName})`;
}; 