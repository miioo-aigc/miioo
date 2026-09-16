/**
 * @file ReferenceRemoveButton.jsx
 * @structure-index
 *
 * ─── 组件职责 ───────────────────────────────────────────────────────
 *   ReferenceRemoveButton 参考素材卡片右上角的悬停移除按钮
 *
 * ─── 更新记录 ───────────────────────────────────────────────────────
 *   2026-09-16  初始实现，统一参考素材解除关联的叉号样式
 */

export default function ReferenceRemoveButton({ visible = false, onClick, ariaLabel = '移除参考素材' }) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      aria-hidden={!visible}
      tabIndex={visible ? 0 : -1}
      onClick={(event) => {
        event.stopPropagation();
        onClick?.(event);
      }}
      style={{
        position: 'absolute',
        top: '4px',
        right: '4px',
        width: '18px',
        height: '18px',
        padding: 0,
        border: 0,
        borderRadius: '4px',
        backgroundColor: 'rgba(0,0,0,0.70)',
        color: '#FFFFFF',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? 'auto' : 'none',
        transition: 'opacity 120ms',
        zIndex: 1,
      }}
    >
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
        <path d="M2 2L8 8M8 2L2 8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    </button>
  );
}
