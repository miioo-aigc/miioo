/**
 * @file DubbingInlineMenuPosition.js
 * @structure-index
 * DubbingInlineMenuPosition：高级配音内联菜单（停顿/语气词）的光标锚点与视口边界计算，纯函数便于单测。
 * 2026-11-09：空 contentEditable 取不到光标矩形时回退到文本区左上角光标行，菜单不再飘到输入框外。
 */

const MENU_GAP = 8;
const VIEWPORT_MARGIN = 8;

/** 空 contentEditable 的折叠光标没有可用矩形：getClientRects 为空且 boundingRect 退化为 (0,0,0,0)。 */
export function isDegenerateRect(rect) {
  return !rect || (rect.width === 0 && rect.height === 0 && rect.top === 0 && rect.left === 0);
}

/** 光标矩形退化时改用文本区左上角光标行，等价于光标停在首行行首。 */
export function resolveInlineMenuAnchorRect(rect, fallbackRect) {
  if (!isDegenerateRect(rect)) return rect;
  return fallbackRect || { top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0 };
}

/** 视口坐标转编辑器相对坐标：默认贴光标行下方，空间不足翻到上方，并夹在视口内。 */
export function resolveInlineMenuOffset(anchorRect, editorRect, menuWidth, menuHeight, viewportWidth, viewportHeight) {
  const belowTop = anchorRect.bottom + MENU_GAP;
  const aboveTop = anchorRect.top - menuHeight - MENU_GAP;
  const top = belowTop + menuHeight <= viewportHeight - VIEWPORT_MARGIN
    ? belowTop
    : aboveTop >= VIEWPORT_MARGIN
      ? aboveTop
      : Math.max(VIEWPORT_MARGIN, Math.min(belowTop, viewportHeight - menuHeight - VIEWPORT_MARGIN));
  const left = Math.max(VIEWPORT_MARGIN, Math.min(anchorRect.left, viewportWidth - menuWidth - VIEWPORT_MARGIN));
  return { top: top - editorRect.top, left: left - editorRect.left };
}
