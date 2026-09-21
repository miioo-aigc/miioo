/**
 * 无业务输入卡外观层；编辑器和工具栏由调用方提供，禁用仅影响视觉。
 * 2026-09-21 从创作、剧本输入卡提取公共布局与状态样式。
 */
import { useState } from 'react';
import './ComposerSurface.css';

export default function ComposerSurface({
  width,
  focused = false,
  disabled = false,
  dimmed = disabled,
  stretch = false,
  children,
  toolbar,
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="composer-surface"
      data-focused={focused}
      data-hovered={hovered}
      data-dimmed={dimmed}
      data-stretch={stretch}
      style={{ width }}
      onMouseEnter={() => !disabled && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="composer-surface__inner">
        <div className="composer-surface__body">{children}</div>
        <div className="composer-surface__toolbar">{toolbar}</div>
      </div>
    </div>
  );
}
