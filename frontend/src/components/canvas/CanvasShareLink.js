export function parseCanvasShareRoute(pathname) {
  const match = /^\/share\/canvas\/([^/]+)\/?$/.exec(pathname);
  if (!match) return null;
  try { return { token: decodeURIComponent(match[1]) }; }
  catch { return { token: '' }; }
}

export function buildCanvasShareLink(origin, token) {
  if (typeof token !== 'string' || !token.trim()) throw new Error('后端未返回有效的分享凭证');
  return `${new URL(origin).origin}/share/canvas/${encodeURIComponent(token)}`;
}

export async function copyCanvasShareLink(link) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(link);
      return;
    }
  } catch { /* 部分浏览器在异步请求后拒绝剪贴板权限，继续尝试原生复制。 */ }
  const previous = document.activeElement;
  const input = document.createElement('textarea');
  input.value = link;
  input.setAttribute('readonly', '');
  input.style.cssText = 'position:fixed;left:-9999px;top:0';
  document.body.append(input);
  try {
    input.select();
    if (!document.execCommand('copy')) throw new Error('复制失败，请允许浏览器访问剪贴板后重试');
  } finally {
    input.remove();
    previous?.focus?.({ preventScroll: true });
  }
}

export async function enableAndCopyCanvasShare({ canvasId, origin, enable, copy, active = () => true }) {
  const result = await enable(canvasId);
  if (!active()) return false;
  if (result?.share_enabled !== true) throw new Error('后端未成功开启画布分享');
  await copy(buildCanvasShareLink(origin, result.share_token));
  return active();
}
