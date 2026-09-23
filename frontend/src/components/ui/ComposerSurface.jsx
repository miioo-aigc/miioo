/**
 * 无业务输入卡外观层；编辑器和工具栏由调用方提供，禁用仅影响视觉。
 * 2026-09-21 从创作、剧本输入卡提取公共布局与状态样式。
 * 2026-09-23 统一接入 BorderBeam，保留业务插槽及原有尺寸。
 * 2026-09-23 聚焦时冻结边框动效，移除蓝色高亮；失焦后继续。
 */
import { useState } from 'react';
import { BorderBeam } from 'border-beam';
import './ComposerSurface.css';

export default function ComposerSurface({
  width,
  focused = false,
  disabled = false,
  dimmed = disabled,
  stretch = false,
  beamActive = true,
  beamStrength = 0.7,
  beamColorVariant = 'colorful',
  children,
  toolbar,
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <BorderBeam
      size="md"
      colorVariant={beamColorVariant}
      strength={beamStrength}
      active={beamActive && !disabled}
      theme="dark"
      borderRadius={20}
      className="composer-surface"
      data-focused={focused}
      data-hovered={hovered}
      data-dimmed={dimmed}
      data-stretch={stretch}
      style={{ width, display: 'flex', overflow: 'visible' }}
      onMouseEnter={() => !disabled && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="composer-surface__inner">
        <div className="composer-surface__body">{children}</div>
        <div className="composer-surface__toolbar">{toolbar}</div>
      </div>
    </BorderBeam>
  );
}
