/**
 * promptHTML 本地缓存
 *
 * 用途：新数据的 prompt 已剥离文件名，刷新页面后无法从 server 返回的纯文本 prompt
 * 重建 @ 标签芯片位置。此模块在图片生成成功时将 promptHTML 写入 localStorage，
 * normalizeHistoryItem 加载历史数据时读取，实现零后端改动的芯片位置保留。
 *
 * Key:   图片的规范化 URL（normalizeImageUrl 结果）
 * Value: promptHTML 字符串
 */

const CACHE_KEY = 'miioo_prompt_html_v1';
/** 最多保留条目数，超出时删除最早插入的旧条目 */
const MAX_ENTRIES = 400;

/**
 * 将 promptHTML 与图片 URL 关联写入缓存。
 * @param {string} imageUrl - 规范化后的图片 URL
 * @param {string} promptHTML - 含 @ 标签 span 的 HTML 字符串
 */
export function cachePromptHTML(imageUrl, promptHTML) {
  if (!imageUrl || !promptHTML) return;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    const cache = raw ? JSON.parse(raw) : {};
    cache[imageUrl] = promptHTML;
    const keys = Object.keys(cache);
    if (keys.length > MAX_ENTRIES) {
      // 删除最早插入的条目（Object.keys 保持插入顺序）
      keys.slice(0, keys.length - MAX_ENTRIES).forEach((k) => delete cache[k]);
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // localStorage 不可用（无痕模式、已满）时静默跳过
  }
}

/**
 * 根据图片 URL 读取缓存的 promptHTML。
 * @param {string} imageUrl - 规范化后的图片 URL
 * @returns {string} 缓存的 promptHTML，未命中时返回空串
 */
export function getCachedPromptHTML(imageUrl) {
  if (!imageUrl) return '';
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return '';
    const cache = JSON.parse(raw);
    return cache[imageUrl] || '';
  } catch {
    return '';
  }
}
