/**
 * @file Tooltip.jsx
 * @structure-index
 *
 * ─── 组件职责 ───────────────────────────────────────────────────────
 *   Tooltip 显示跟随触发元素的纯文字悬停提示
 *
 * ─── 依赖边界 ───────────────────────────────────────────────────────
 *   仅负责通用视觉、悬停状态和 Portal 定位；不引用页面、业务 API 或 Store
 *
 * ─── 更新记录 ───────────────────────────────────────────────────────
 *   2026-07-31  按设计系统 Tooltip 规范新增通用提示组件
 *   2026-08-19  支持通过换行符展示多行纯文字提示
 */
import { useState } from 'react';
import { createPortal } from 'react-dom';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif";

export default function Tooltip({ label, children, offset = 4, color = '#FFFFFF', multiline = false }) {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState(null);

  function handleMouseEnter(event) {
    setVisible(true);
    const rect = event.currentTarget.getBoundingClientRect();
    setPosition({ left: rect.left + rect.width / 2, top: rect.top });
  }

  function handleMouseLeave() {
    setVisible(false);
    setPosition(null);
  }

  return (
    <span
      style={{ display: 'inline-flex', position: 'relative' }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      {visible && position && createPortal(
        <span
          role="tooltip"
          style={{
            position: 'fixed',
            left: position.left,
            top: position.top,
            transform: `translate(-50%, calc(-100% - ${offset}px))`,
            zIndex: 10000,
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '2px 8px',
            borderRadius: '2px',
            backgroundColor: '#090909',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            whiteSpace: multiline ? 'pre-line' : 'nowrap',
            color,
            fontFamily: FONT,
            fontSize: '12px',
            lineHeight: '16px',
          }}
        >
          {label}
        </span>,
        document.body,
      )}
    </span>
  );
}
