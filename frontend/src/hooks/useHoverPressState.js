/**
 * 管理按钮的 hover / pressed 展示状态。
 * 只负责指针状态，不包含业务动作或视觉判断。
 */
import { useState } from 'react';

export function useHoverPressState() {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  return {
    hovered,
    pressed,
    pointerProps: {
      onMouseEnter: () => setHovered(true),
      onMouseLeave: () => {
        setHovered(false);
        setPressed(false);
      },
      onMouseDown: () => setPressed(true),
      onMouseUp: () => setPressed(false),
    },
  };
}
