/**
 * @file CanvasCenterPrompt.jsx
 * @structure-index
 *
 * ─── 展示层 ─────────────────────────────────────────────────────
 *   CanvasCenterPrompt 画布空态提示胶囊
 */

export default function CanvasCenterPrompt() {
  return (
    <div className="pointer-events-auto flex cursor-default items-center gap-[6px] rounded-full bg-surface-toolbar px-[16px] py-[8px] antialiased">
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" className="shrink-0">
        <path d="M8 1.333V4" fill="none" stroke="var(--color-text-secondary)" strokeLinecap="round" strokeLinejoin="round" />
        <path fillRule="evenodd" clipRule="evenodd" d="M7.333 7.333L14 8.667L12 10L14 12L12 14L10 12L8.667 14L7.333 7.333Z" fill="none" stroke="var(--color-text-secondary)" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M12.714 3.286L10.829 5.172M3.286 12.714L5.172 10.829M1.333 8H4M3.286 3.286L5.172 5.172" fill="none" stroke="var(--color-text-secondary)" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="shrink-0 text-[14px] leading-[18px] text-text-secondary">双击画布，添加节点</span>
    </div>
  );
}
