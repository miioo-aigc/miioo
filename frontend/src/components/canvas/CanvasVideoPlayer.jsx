/**
 * @file CanvasVideoPlayer.jsx
 * @structure-index
 * CanvasVideoPlayer：保留原生视频控件，仅管理显隐与画面拖动区域。
 * 2026-09-28：悬停开启原生 controls，透明画面层响应节点拖动，底部留给原生控件。
 */
import { useState } from 'react';

export default function CanvasVideoPlayer({ src, poster }) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const controlsVisible = hovered || focused;
  return <div
    className="canvas-video"
    data-controls-visible={controlsVisible}
    onMouseEnter={() => setHovered(true)}
    onMouseLeave={() => setHovered(false)}
    onFocus={(event) => {
      if (event.target.matches(':focus-visible')) setFocused(true);
    }}
    onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
    }}
  >
    <video
      className="canvas-node__media nodrag nopan"
      src={src}
      poster={poster}
      muted
      playsInline
      preload="metadata"
      controls={controlsVisible}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    />
    <div className="canvas-video__drag-surface" aria-hidden="true" />
  </div>;
}
