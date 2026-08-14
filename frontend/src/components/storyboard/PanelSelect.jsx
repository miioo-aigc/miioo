/**
 * @file PanelSelect.jsx
 * @structure-index
 *
 * ─── 组件职责 ───────────────────────────────────────────────
 *   PanelSelect       生成面板标签、当前值、下拉展开和选项选择
 *   ModalSelectItem   下拉选项的激活、悬停和选择交互
 *
 * ─── 依赖边界 ───────────────────────────────────────────────
 *   仅接收 value、options、disabled 和 onChange 等显式 props；
 *   不读取页面状态、不调用业务 API、不依赖页面 Store。
 *
 * ─── 更新记录 ───────────────────────────────────────────────
 *   2026-08-14  下拉菜单限制最大高度为 5 个选项，超出后固定面板内滚动；打开时自动滚到当前选中项
 */

import { useEffect, useRef, useState } from 'react';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif";
const ITEM_HEIGHT = 36;
const MENU_MAX_HEIGHT = ITEM_HEIGHT * 5 + 8; // 最多展示 5 项（含容器 padding 8px）

function ModalSelectItem({ label, active, onSelect }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', height: '36px', paddingInline: '12px',
        borderRadius: '6px', cursor: 'pointer',
        backgroundColor: active ? 'rgba(255,255,255,0.08)' : hov ? 'rgba(255,255,255,0.05)' : 'transparent',
        color: active || hov ? '#FFFFFF' : 'rgba(255,255,255,0.60)',
        fontSize: '14px', lineHeight: '18px', fontFamily: FONT,
        transition: 'background-color 0.08s',
      }}
      data-active={active || undefined}
      onClick={onSelect}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >
      {label}
    </div>
  );
}

export default function PanelSelect({ label, value, options = [], onChange, disabled = false }) {
  const [open, setOpen] = useState(false);
  const [hov, setHov] = useState(false);
  const ref = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    function onDown(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDown, true);
    return () => document.removeEventListener('mousedown', onDown, true);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const activeItem = menuRef.current?.querySelector('[data-active="true"]');
    activeItem?.scrollIntoView({ block: 'nearest' });
    return undefined;
  }, [open]);

  const borderColor = open ? 'rgba(45,195,225,0.60)' : hov ? 'rgba(255,255,255,0.20)' : 'rgba(255,255,255,0.08)';
  const outlineColor = open ? 'rgba(45,195,225,0.12)' : '#00000080';
  const outlineWidth = open ? '3px' : '1px';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignSelf: 'stretch' }}>
      {label && <span style={{ fontSize: '14px', lineHeight: '18px', color: 'rgba(255,255,255,0.60)', fontFamily: FONT }}>{label}</span>}
      <div ref={ref} style={{ position: 'relative' }}>
        <div
          style={{
            display: 'flex', alignItems: 'center', height: '36px', width: '100%',
            borderRadius: '8px', paddingInline: '12px', gap: '8px', flexShrink: 0,
            backgroundColor: disabled ? '#131313' : hov ? '#222323' : '#1D1E1E',
            border: `1px solid ${disabled ? 'rgba(255,255,255,0.06)' : borderColor}`,
            outline: `${outlineWidth} solid ${disabled ? '#00000080' : outlineColor}`,
            cursor: disabled ? 'not-allowed' : 'pointer',
            transition: 'background-color 0.10s, border-color 0.10s',
            boxSizing: 'border-box',
            opacity: disabled ? 0.5 : 1,
          }}
          onClick={() => { if (!disabled) setOpen((v) => !v); }}
          onMouseEnter={() => { if (!disabled) setHov(true); }}
          onMouseLeave={() => setHov(false)}
        >
          <span style={{ flex: 1, fontSize: '14px', lineHeight: '18px', color: disabled ? 'rgba(255,255,255,0.40)' : '#FFFFFF', fontFamily: FONT }}>{value}</span>
          {!disabled && (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
              <path d="M12 6.333L8 10.333L4 6.333H12Z" fill="#FFFFFF" stroke="#FFFFFF" strokeWidth="1.333" strokeLinejoin="round" />
            </svg>
          )}
        </div>
        {open && (
          <div ref={menuRef} className="panel-select-menu" style={{
            position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
            backgroundColor: '#1D1E1E', border: '1px solid rgba(255,255,255,0.10)',
            borderRadius: '8px', padding: '4px', zIndex: 10,
            boxShadow: '0 4px 16px rgba(0,0,0,0.40)',
            maxHeight: MENU_MAX_HEIGHT, overflowY: 'auto', overflowX: 'hidden',
            boxSizing: 'border-box',
          }}>
            {options.map((opt) => (
              <ModalSelectItem key={opt} label={opt} active={opt === value} onSelect={() => { onChange(opt); setOpen(false); }} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export { ModalSelectItem };
