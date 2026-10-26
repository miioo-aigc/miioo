import { useRef } from 'react';

/** 原卡片与失败浮层之间的移入桥接；状态只属于当前预览宿主。 */
export function useHoverPreviewBoundary(close) {
  const pinned = useRef(false);
  const origin = useRef(false);
  return {
    enter() { origin.current = true; pinned.current = false; },
    leave() { origin.current = false; if (!pinned.current) close(); },
    pin(value) { pinned.current = value; if (!value && !origin.current) close(); },
    dismiss() { pinned.current = false; close(); },
  };
}
