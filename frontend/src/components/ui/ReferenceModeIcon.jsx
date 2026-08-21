/**
 * @file ReferenceModeIcon.jsx
 * @structure-index
 *
 * ─── 组件职责 ───────────────────────────────────────────────────────
 *   ReferenceModeIcon 按视频参考模式渲染统一的静态图标
 *
 * ─── 依赖边界 ───────────────────────────────────────────────────────
 *   仅接收参考模式和值尺寸，不读取业务状态、不调用 API。
 */

const MODE_BY_LABEL = {
  '全能参考': 'all',
  '智能多帧': 'multi_shot',
  '首尾帧': 'frame',
};

function normalizeMode(mode) {
  return MODE_BY_LABEL[mode] || mode;
}

export function ReferenceModeIcon({ mode, size = 16 }) {
  const normalizedMode = normalizeMode(mode);
  const commonProps = {
    width: size,
    height: size,
    fill: 'none',
    viewBox: '0 0 16 16',
    xmlns: 'http://www.w3.org/2000/svg',
    style: { flexShrink: 0 },
  };

  if (normalizedMode === 'frame') {
    return (
      <svg {...commonProps} viewBox="0 0 24 24">
        <path d="M9.446 1.733C9.888 1.733 10.246 2.092 10.246 2.533V21.855C10.246 22.297 9.888 22.655 9.447 22.655C9.005 22.655 8.646 22.297 8.646 21.855V2.533C8.646 2.092 9.005 1.733 9.447 1.733H9.446ZM9.194 3.483V5.083H4.706C4.411 5.083 4.172 5.322 4.172 5.617V18.946C4.172 19.241 4.411 19.479 4.706 19.479H9.194V21.079H4.706C3.527 21.079 2.572 20.124 2.572 18.946V5.617C2.572 4.438 3.527 3.483 4.706 3.483H9.194ZM3.814 8.787H9.446V7.187H3.814V8.787ZM3.814 17.402H9.446V15.802H3.814V17.402ZM14.706 1.733C14.264 1.733 13.906 2.092 13.906 2.533V21.855C13.906 22.297 14.264 22.655 14.706 22.655C15.148 22.655 15.506 22.297 15.506 21.855V2.533C15.506 2.092 15.148 1.733 14.706 1.733ZM14.957 3.483V5.083H19.446C19.74 5.083 19.979 5.322 19.979 5.617V18.946C19.979 19.241 19.74 19.479 19.446 19.479H14.957V21.079H19.446C20.624 21.079 21.579 20.124 21.579 18.946V5.617C21.579 4.438 20.624 3.483 19.446 3.483H14.957ZM20.339 8.787H14.707V7.187H20.339V8.787ZM20.339 17.402H14.707V15.802H20.339V17.402Z" fill="currentColor" />
      </svg>
    );
  }

  if (normalizedMode === 'multi_shot' || normalizedMode === 'multi') {
    return (
      <svg {...commonProps}>
        <path d="M8.381 12.382 2.512 13.63.641 4.826l3.668-.78" stroke="currentColor" strokeOpacity=".6" strokeLinejoin="round" />
        <path d="M7.5 12h-3V3h6v.793" stroke="currentColor" strokeOpacity=".8" strokeLinejoin="round" />
        <rect x="9.781" y="3.274" width="6" height="9" transform="rotate(18 9.781 3.274)" stroke="currentColor" strokeLinejoin="round" />
      </svg>
    );
  }

  return (
    <svg {...commonProps}>
      <path d="M12.619 6.667V8v1.333M9.155 12.667 10.31 12l1.154-.667M6.845 12.667 5.69 12l-1.154-.667M3.381 6.667V8v1.333M4.536 4.667 5.69 4l1.155-.667M9.155 3.333 10.31 4l1.154.667" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="8" cy="13.333" r="1.333" stroke="currentColor" />
      <circle cx="8" cy="2.667" r="1.333" stroke="currentColor" />
      <circle cx="8" cy="8" r="1.333" stroke="currentColor" />
      <circle cx="12.667" cy="5.333" r="1.333" stroke="currentColor" />
      <circle cx="12.667" cy="10.667" r="1.333" stroke="currentColor" />
      <circle cx="3.333" cy="5.333" r="1.333" stroke="currentColor" />
      <circle cx="3.333" cy="10.667" r="1.333" stroke="currentColor" />
    </svg>
  );
}
