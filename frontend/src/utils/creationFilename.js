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

// 仅识别配音编辑器支持的标记，普通括号及未知标记保留为正文。
export function audioFilenameFromPrompt(prompt, ext = '') {
  const text = String(prompt ?? '')
    .replace(/\{\/?(?:calm|fearful|happy|sad|fluent|angry|surprised|disgusted)\}/g, '')
    .replace(/<#\d+(?:\.\d+)?#>/g, '')
    .replace(/\((?:laughs|chuckle|coughs|clear-throat|groans|breath|pant|inhale|exhale|gasps|sniffs|sighs|snorts|humming|burps|lip-smacking|hissing|emm|sneezes)\)/g, '');
  const filename = filenameFromPrompt(text, ext, '配音');
  return ext ? filename : filename.slice(0, -1);
}
