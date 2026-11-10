/**
 * 画布媒体是否应因模态对话框而停止自动播放。
 * 画布常驻的 role="dialog" 面板（节点导航器、节点结果浮层、下拉菜单）收起时仍留在 DOM 里，
 * 只有真正打开、可见且未休眠的模态对话框才阻断播放，避免常驻元素让视频一直停在封面层。
 */
export function hasBlockingDialog(doc = typeof document === 'undefined' ? undefined : document) {
  if (!doc?.querySelector) return false;
  const dialog = doc.querySelector('[role="dialog"][aria-modal="true"], [role="alertdialog"]');
  if (!dialog) return false;
  if (dialog.hasAttribute('inert')) return false;
  if (dialog.getAttribute('aria-hidden') === 'true') return false;
  return dialog.getClientRects().length > 0;
}
