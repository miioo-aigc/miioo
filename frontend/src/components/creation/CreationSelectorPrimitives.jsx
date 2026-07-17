import { useEffect, useRef, useState } from 'react';

export const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif";

// ─── Dropdown ─────────────────────────────────────────────────────────────────
export function Dropdown({ trigger, children, open, onClose, dropUp = true }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, onClose]);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {trigger}
      {open && (
        <div
          style={{
            position: 'absolute',
            zIndex: 50,
            left: 0,
            [dropUp ? 'bottom' : 'top']: 'calc(100% + 4px)',
            borderRadius: '8px',
            overflow: 'hidden',
            background: '#1D1E1E',
            border: '1px solid #FFFFFF0D',
            boxShadow: '0px 4px 16px #00000066',
            minWidth: '112px',
            padding: '4px',
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export function GenTypeDropdownItem({ label, iconSelected, iconDefault, selected, onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        width: '100%',
        paddingLeft: '12px',
        paddingRight: '12px',
        paddingTop: '8px',
        paddingBottom: '8px',
        borderRadius: '6px',
        cursor: 'pointer',
        border: 'none',
        textAlign: 'left',
        fontFamily: FONT,
        fontSize: '14px',
        lineHeight: '18px',
        color: selected ? '#FFFFFF' : '#FFFFFF99',
        background: selected ? '#FFFFFF0D' : hovered ? '#FFFFFF0A' : 'transparent',
        transition: 'background 0.15s',
      }}
    >
      {selected ? iconSelected : iconDefault}
      {label}
    </button>
  );
}

export function DropdownItem({ label, selected, onClick, icon }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        width: '100%',
        height: '32px',
        paddingLeft: '12px',
        paddingRight: '12px',
        cursor: 'pointer',
        border: 'none',
        textAlign: 'left',
        fontFamily: FONT,
        fontSize: '12px',
        lineHeight: '16px',
        color: selected ? '#FFFFFF' : '#FFFFFFCC',
        background: selected ? '#FFFFFF14' : hovered ? '#FFFFFF0A' : 'transparent',
        transition: 'background 0.15s',
      }}
    >
      {icon && icon}
      <span style={{
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>{label}</span>
    </button>
  );
}

export function RatioIcon({ rw = 16, rh = 9, selected = false }) {
  const maxW = 16, maxH = 12;
  // 竖屏比例（宽 < 高）以「横屏等价比例」的宽高置换来绘制：
  // 先按横屏方向拟合到 16×12，再整体转置，使其与横屏成对一致（如 3:4 即为 4:3 的宽高置换）。
  const portrait = rh > rw;
  const baseW = portrait ? rh : rw;
  const baseH = portrait ? rw : rh;
  const scale = Math.min(maxW / baseW, maxH / baseH);
  const wBase = Math.round(baseW * scale);
  const hBase = Math.round(baseH * scale);
  const w = portrait ? hBase : wBase;
  const h = portrait ? wBase : hBase;
  return (
    <div style={{
      width: `${w}px`,
      height: `${h}px`,
      borderRadius: '2px',
      flexShrink: 0,
      boxShadow: selected ? '#FFFFFF 0px 0px 0px 1px inset' : '#FFFFFF66 0px 0px 0px 1px inset',
    }} />
  );
}
