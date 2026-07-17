/**
 * 从提示词生成安全下载文件名。纯函数，不执行下载或浏览器副作用。
 */

export function filenameFromPrompt(prompt, ext, fallback = 'creation') {
  const base = (prompt || '')
    .replace(/[\\/:*?"<>|\r\n\t]/g, '')
    .trim()
    .slice(0, 10)
    .trim();
  return `${base || fallback}.${ext}`;
}
