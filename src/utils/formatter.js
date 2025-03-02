/**
 * フォーマッタユーティリティ
 * 出力の整形や日付の処理などを行う
 */

/**
 * 現在の日時をYYYYMMDD_HHMMSSの形式で返す
 * @returns {string} フォーマットされた日時文字列
 */
export const getFormattedDateTime = () => {
  const now = new Date();
  
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  
  return `${year}${month}${day}_${hours}${minutes}${seconds}`;
};

/**
 * 現在の日付をYYYYMMDDの形式で返す
 * @returns {string} フォーマットされた日付文字列
 */
export const getFormattedDate = () => {
  const now = new Date();
  
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  
  return `${year}${month}${day}`;
};

/**
 * 文字列を指定した行数で切り詰める
 * @param {string} text - 元の文字列
 * @param {number} maxLines - 最大行数
 * @returns {string} 切り詰められた文字列
 */
export const truncateLines = (text, maxLines) => {
  if (!text) return '';
  
  const lines = text.split('\n');
  if (lines.length <= maxLines) return text;
  
  return [...lines.slice(0, maxLines), `... (${lines.length - maxLines} more lines)`].join('\n');
};

/**
 * 文字列を指定した長さで切り詰める
 * @param {string} text - 元の文字列
 * @param {number} maxLength - 最大文字数
 * @returns {string} 切り詰められた文字列
 */
export const truncateText = (text, maxLength) => {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  
  return text.substring(0, maxLength) + '...';
};

/**
 * オブジェクトを人間が読みやすいJSON形式に整形する
 * @param {Object} obj - 整形するオブジェクト
 * @returns {string} 整形されたJSON文字列
 */
export const formatJSON = (obj) => {
  try {
    return JSON.stringify(obj, null, 2);
  } catch (error) {
    return '[形式エラー: JSONへの変換失敗]';
  }
};

/**
 * ミリ秒を読みやすい形式に変換する (例: "2.5s", "150ms")
 * @param {number} ms - ミリ秒
 * @returns {string} 整形された時間文字列
 */
export const formatDuration = (ms) => {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
};

/**
 * 指定されたファイル名に日時を付加する
 * @param {string} baseName - ベースファイル名
 * @param {string} extension - 拡張子 (例: "md", "json")
 * @returns {string} 日時付きファイル名
 */
export const getTimestampedFilename = (baseName, extension) => {
  // 既に日付パターン（YYYYMMDD形式）が含まれているかチェック
  const datePattern = /\d{8}/;
  if (datePattern.test(baseName)) {
    // 日付が既に含まれている場合は時間だけを追加
    const timeStamp = getFormattedDateTime().substring(9); // _HHMMSS部分のみ取得
    return `${baseName}${timeStamp}.${extension}`;
  }
  
  // 日付が含まれていない場合は通常通り日時を追加
  return `${baseName}_${getFormattedDateTime()}.${extension}`;
};

/**
 * 改行をHTML改行タグに変換する
 * @param {string} text - 元の文字列
 * @returns {string} 変換された文字列
 */
export const nlToBr = (text) => {
  if (!text) return '';
  return text.replace(/\n/g, '<br>');
};

/**
 * マークダウンのコードブロックを抽出する
 * @param {string} markdown - マークダウン文字列
 * @returns {Array<{language: string, code: string}>} 抽出されたコードブロック
 */
export const extractCodeBlocks = (markdown) => {
  if (!markdown) return [];
  
  const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
  const codeBlocks = [];
  let match;
  
  while ((match = codeBlockRegex.exec(markdown)) !== null) {
    codeBlocks.push({
      language: match[1] || 'text',
      code: match[2]
    });
  }
  
  return codeBlocks;
};

/**
 * マークダウン形式の目次を生成する
 * @param {string} markdown - マークダウン文字列
 * @returns {string} 目次を表すマークダウン文字列
 */
export const generateTableOfContents = (markdown) => {
  if (!markdown) return '';
  
  const headingRegex = /^(#{1,6})\s+(.+)$/gm;
  const headings = [];
  let match;
  
  while ((match = headingRegex.exec(markdown)) !== null) {
    const level = match[1].length;
    const text = match[2].trim();
    const anchor = text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
    
    headings.push({ level, text, anchor });
  }
  
  if (headings.length === 0) return '';
  
  let toc = '## 目次\n\n';
  
  headings.forEach(heading => {
    const indent = '  '.repeat(heading.level - 1);
    toc += `${indent}- [${heading.text}](#${heading.anchor})\n`;
  });
  
  return toc;
}; 