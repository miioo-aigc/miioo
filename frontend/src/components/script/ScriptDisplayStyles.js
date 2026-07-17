/**
 * @file ScriptDisplayStyles.js
 * @structure-index
 *
 * ─── 样式注入 ───────────────────────────────────────────────────────
 *   剧本思考动画、滚动条、流式光标和按钮加载动画
 *
 * ─── 更新记录 ───────────────────────────────────────────────────────
 *   2026-07-15  从 ScriptPage 抽离剧本展示区域专属样式
 */
const DISPLAY_STYLE_ID = 'script-display-style';

export function ensureScriptDisplayStyles() {
  if (document.getElementById(DISPLAY_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = DISPLAY_STYLE_ID;
  style.textContent = `
    @keyframes thinking-dot {
      0%, 60%, 100% { opacity: 0.2; transform: translateY(0px); }
      30% { opacity: 1; transform: translateY(-4px); }
    }
    @keyframes thinking-label-in {
      from { opacity: 0; transform: translateY(6px); }
      to { opacity: 1; transform: translateY(0px); }
    }
    @keyframes thinking-label-out {
      from { opacity: 1; transform: translateY(0px); }
      to { opacity: 0; transform: translateY(-6px); }
    }
    .thinking-dot { animation: thinking-dot 1.4s ease-in-out infinite; }
    .thinking-dot:nth-child(1) { animation-delay: 0s; }
    .thinking-dot:nth-child(2) { animation-delay: 0.2s; }
    .thinking-dot:nth-child(3) { animation-delay: 0.4s; }
    .thinking-label-in { animation: thinking-label-in 0.35s cubic-bezier(0.4,0,0.2,1) forwards; }
    .thinking-label-out { animation: thinking-label-out 0.25s cubic-bezier(0.4,0,0.2,1) forwards; }

    .script-scroll::-webkit-scrollbar { width: 4px; }
    .script-scroll::-webkit-scrollbar-track { background: transparent; }
    .script-scroll::-webkit-scrollbar-thumb { background: transparent; border-radius: 9999px; transition: background 0.2s; }
    .script-scroll:hover::-webkit-scrollbar-thumb { background: #FFFFFF0D; }
    @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
    .ai-text--typing::after { content: '|'; display: inline; opacity: 1; animation: blink 1s step-end infinite; color: #FFFFFFCC; margin-left: 1px; }
    @keyframes btn-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  `;
  document.head.appendChild(style);
}
