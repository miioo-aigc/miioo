/** 输入、组合输入及弹窗期间不切换画布工具。 */
export function getCanvasToolShortcut(event, enabled = true) {
  if (!enabled || event.defaultPrevented || event.isComposing || event.keyCode === 229
    || event.repeat || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey
    || event.target?.isContentEditable
    || event.target?.closest?.('input, textarea, select, [contenteditable="true"], [role="textbox"], [role="dialog"]')) return null;
  return { v: 'select', h: 'hand' }[event.key?.toLowerCase()] || null;
}
