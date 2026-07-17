/**
 * @file TextButton.jsx
 * @structure-index
 *
 * ─── 组件职责 ───────────────────────────────────────────────────────
 *   TextButton 文字按钮
 *
 * ─── 更新记录 ───────────────────────────────────────────────────────
 *   2026-07-15  初始实现
 */
import { Button } from './Button';

/**
 * 文字按钮：默认使用低视觉权重的 Secondary 变体。
 */
export function TextButton({ children, variant = 'secondary', ...props }) {
  return (
    <Button variant={variant} {...props}>
      {children}
    </Button>
  );
}

export default TextButton;
