/** 画布视频模式图标：2026-09-30，使用设计稿几何，菜单交互只改变整体透明度。 */
const WHITE = 'var(--color-white-100)';
const DIM = 'var(--color-white-40)';
const MUTED = 'var(--color-white-60)';

function FramePaths({ mode }) {
  return <>
    <g data-frame-side="left" fill={mode === 'last_frame' ? DIM : WHITE}>
      <path d="M9.446 1.733C9.888 1.733 10.246 2.092 10.246 2.533V21.855C10.246 22.297 9.888 22.655 9.447 22.655C9.005 22.655 8.646 22.297 8.646 21.855V2.533C8.646 2.092 9.005 1.733 9.447 1.733H9.446Z" />
      <path d="M9.194 3.483V5.083H4.706C4.411 5.083 4.172 5.322 4.172 5.617V18.946C4.172 19.241 4.411 19.479 4.706 19.479H9.194V21.079H4.706C3.527 21.079 2.572 20.124 2.572 18.946V5.617C2.572 4.438 3.527 3.483 4.706 3.483H9.194Z" />
      <path d="M3.814 8.787L9.446 8.787L9.446 7.187L3.814 7.187L3.814 8.787ZM3.814 17.402L9.446 17.402L9.446 15.802L3.814 15.802L3.814 17.402Z" />
    </g>
    <g data-frame-side="right" fill={mode === 'first_frame' ? DIM : WHITE}>
      <path d="M14.706 22.655C15.148 22.655 15.506 22.297 15.506 21.855L15.506 2.533C15.506 2.092 15.148 1.733 14.706 1.733C14.264 1.733 13.906 2.092 13.906 2.533L13.906 21.855C13.906 22.297 14.264 22.655 14.706 22.655Z" />
      <path d="M14.957 3.483V5.083H19.446C19.74 5.083 19.979 5.322 19.979 5.617V18.946C19.979 19.241 19.74 19.479 19.446 19.479H14.957V21.079H19.446C20.624 21.079 21.579 20.124 21.579 18.946V5.617C21.579 4.438 20.624 3.483 19.446 3.483H14.957Z" />
      <path d="M20.339 8.787H14.707V7.187H20.339V8.787ZM20.339 17.402H14.707V15.802H20.339V17.402Z" />
    </g>
  </>;
}

function ImagePaths() {
  return <g fill="none" stroke={WHITE} strokeLinecap="round" strokeLinejoin="round">
    <path transform="translate(1.667 2.667)" d="M0 0.667C0 0.298 0.298 0 0.667 0H12C12.368 0 12.667 0.298 12.667 0.667V10C12.667 10.368 12.368 10.667 12 10.667H0.667C0.298 10.667 0 10.368 0 10V0.667Z" vectorEffect="non-scaling-stroke" />
    <path transform="translate(4.333 5)" d="M0.5 1C0.776 1 1 0.776 1 0.5C1 0.224 0.776 0 0.5 0C0.224 0 0 0.224 0 0.5C0 0.776 0.224 1 0.5 1Z" vectorEffect="non-scaling-stroke" />
    <path transform="translate(1.667 7)" d="M3.333 1L5 2.333L7 0L12.667 4.333V5.667C12.667 6.035 12.368 6.333 12 6.333H0.667C0.298 6.333 0 6.035 0 5.667V4.333L3.333 1Z" vectorEffect="non-scaling-stroke" />
  </g>;
}

function VideoPaths() {
  return <g fill="none" strokeLinecap="round" strokeLinejoin="round">
    <path transform="translate(3.667 2.333)" d="M0 0H8.667V11.333H0V0Z" vectorEffect="non-scaling-stroke" stroke={WHITE} />
    <path transform="translate(1.333 3.667)" d="M2.333 8.667H0V0H2.333" vectorEffect="non-scaling-stroke" stroke={MUTED} />
    <path transform="translate(12.333 3.667)" d="M0 0H2.333V8.667H0" vectorEffect="non-scaling-stroke" stroke={MUTED} />
    <g transform="translate(7.333 6.667)">
      <path d="M0 0L2 1.333L0 2.667V0Z" fillRule="nonzero" fill={MUTED} />
      <path d="M0 0L2 1.333L0 2.667V0Z" vectorEffect="non-scaling-stroke" fill={WHITE} stroke={WHITE} paintOrder="stroke" />
    </g>
  </g>;
}

export default function CanvasVideoModeIcon({ mode, active = false }) {
  const frame = ['first_frame', 'last_frame', 'start_end'].includes(mode);
  return <svg data-canvas-video-mode={mode} width="16" height="16"
    viewBox={frame ? '0 0 24 24' : '0 0 16 16'} xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true" style={{ width: '16px', height: '16px', overflow: 'visible', opacity: active ? 1 : 0.6, flexShrink: 0 }}>
    {frame ? <FramePaths mode={mode} /> : mode === 'text_to_video' ? <g fill="none" stroke={WHITE}>
      <path d="M8 14.667C11.682 14.667 14.667 11.682 14.667 8C14.667 4.318 11.682 1.333 8 1.333C4.318 1.333 1.333 4.318 1.333 8C1.333 11.682 4.318 14.667 8 14.667Z" />
      <path d="M10.667 5.333H5.333M8 11.333V5.333" strokeLinecap="round" strokeLinejoin="round" />
    </g> : ['reference_images', 'reference_subjects'].includes(mode) ? <ImagePaths /> : <VideoPaths />}
  </svg>;
}
