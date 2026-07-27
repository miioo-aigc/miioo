/**
 * 触发浏览器 Blob 下载。仅负责临时 URL 和 DOM 锚点生命周期，不包含业务语义。
 */
export function downloadBlob(blob, filename) {
  if (!blob || !filename) return;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  // 延迟释放，避免部分浏览器在 click 事件结束前还未开始读取 Blob。
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
