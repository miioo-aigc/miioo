/**
 * @file ScriptInputStyles.js
 * @structure-index
 *
 * ─── 样式注入 ───────────────────────────────────────────────────────
 *   会话输入框旋转渐变动画
 *
 * ─── 更新记录 ───────────────────────────────────────────────────────
 *   2026-07-15  从 ScriptPage 抽离输入区专属动画样式
 */
const ROTATE_STYLE_ID = 'chatbox-rotate-keyframe';

export function ensureScriptInputStyle() {
  if (document.getElementById(ROTATE_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = ROTATE_STYLE_ID;
  style.textContent = `
    @property --chatbox-angle {
      syntax: '<angle>';
      initial-value: 161.1deg;
      inherits: false;
    }
    @keyframes chatbox-spin {
      from { --chatbox-angle: 161.1deg; }
      to { --chatbox-angle: 521.1deg; }
    }
  `;
  document.head.appendChild(style);
}
