/**
 * @file IconButton.jsx
 * @structure-index
 *
 * ─── 组件职责 ───────────────────────────────────────────────────────
 *   IconButton 仅图标按钮
 *
 * ─── 更新记录 ───────────────────────────────────────────────────────
 *   2026-07-15  初始实现
 */
import { Button } from './Button';

/**
 * 仅图标按钮。调用方必须提供 aria-label，保证键盘和读屏用户可以理解操作。
 */
export function IconButton({ 'aria-label': ariaLabel, size = 'small', className = '', ...props }) {
  return (
    <Button
      {...props}
      size={size}
      iconOnly
      aria-label={ariaLabel}
      className={className}
    />
  );
}

export default IconButton;
