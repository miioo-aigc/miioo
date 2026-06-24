/**
 * 浏览器下载辅助 / Browser download helper.
 * 纯函数，无 React 依赖。
 */

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export { triggerDownload };
