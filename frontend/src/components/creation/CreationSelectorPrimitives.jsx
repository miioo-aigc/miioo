import { useEffect, useRef, useState } from 'react';
export { RatioIcon } from '../ui/RatioIcon';

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
  const hasIconSlot = icon !== undefined;
  const iconDimmed = hasIconSlot && !selected && !hovered;
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
        borderRadius: '6px',
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
      {hasIconSlot && (
        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16, flexShrink: 0, opacity: iconDimmed ? 0.6 : 1, transition: 'opacity 0.15s' }}>
          {icon}
        </span>
      )}
      <span style={{
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>{label}</span>
    </button>
  );
}
