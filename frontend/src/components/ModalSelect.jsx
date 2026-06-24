import { useState, useEffect, useRef, memo } from 'react';
import { FONT } from '../utils/fonts';
import ModalSelectItem from './ModalSelectItem';

function ModalSelect({ label, value, options, onChange }) {
  const [open, setOpen] = useState(false);
  const [hov, setHov] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    function onDown(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignSelf: 'stretch' }}>
      <span style={{ fontSize: '14px', lineHeight: '18px', color: 'rgba(255,255,255,0.60)', fontFamily: FONT }}>{label}</span>
      <div ref={ref} style={{ position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', height: '36px', width: '100%', borderRadius: '8px', paddingInline: '12px', gap: '8px', flexShrink: 0, backgroundColor: hov ? '#222323' : '#1D1E1E', border: open ? '1px solid rgba(255,255,255,0.20)' : '1px solid rgba(255,255,255,0.08)', outline: '1px solid #00000080', cursor: 'pointer', transition: 'background-color 0.10s, border-color 0.10s', boxSizing: 'border-box' }}
          onClick={() => setOpen((v) => !v)} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}>
          <span style={{ flex: 1, fontSize: '14px', lineHeight: '18px', color: '#FFFFFF', fontFamily: FONT }}>{value}</span>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
            <path d="M12 6.333L8 10.333L4 6.333H12Z" fill="#FFFFFF" stroke="#FFFFFF" strokeWidth="1.333" strokeLinejoin="round" />
          </svg>
        </div>
        {open && (
          <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, backgroundColor: '#1D1E1E', border: '1px solid rgba(255,255,255,0.10)', borderRadius: '8px', padding: '4px', zIndex: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.40)' }}>
            {options.map((opt) => (
              <ModalSelectItem key={opt} label={opt} active={opt === value} onSelect={() => { onChange(opt); setOpen(false); }} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
export default memo(ModalSelect);
