import { useState, useRef, useEffect } from 'react';
import ChevronDownIcon from '../../components/ChevronDownIcon';
import { FONT } from '../../utils/fonts';

export default function SelectField({ label, value, options = [], onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const hasOptions = options.length > 0;

  return (
    <div ref={ref} style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: '0 0 23.4%', position: 'relative' }}>
      <span style={{ fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: '#FFFFFF99' }}>{label}</span>
      <button
        type="button"
        onClick={() => hasOptions && setOpen((v) => !v)}
        style={{
          display: 'flex', alignItems: 'center', height: '36px', width: '100%',
          borderRadius: '8px', padding: '0 12px', gap: '8px',
          background: open ? '#252525' : '#1D1E1E',
          border: `1px solid ${open ? '#FFFFFF33' : '#FFFFFF14'}`,
          outline: `1px solid ${open ? '#2DC3E180' : '#00000080'}`,
          cursor: hasOptions ? 'pointer' : 'default',
          transition: 'background 0.2s, border-color 0.2s',
        }}
      >
        <span style={{ flex: 1, fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: '#FFFFFF', textAlign: 'left' }}>{value}</span>
        <ChevronDownIcon />
      </button>
      {open && hasOptions && (
        <div
          style={{
            position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 60,
            width: '100%', borderRadius: '8px', padding: '4px',
            background: '#1D1E1E', border: '1px solid #FFFFFF14',
            outline: '1px solid #00000080',
            boxShadow: '0px 4px 16px rgba(0,0,0,0.6)',
          }}
        >
          {options.map((opt) => {
            const isSelected = opt === value;
            return (
              <button
                key={opt}
                type="button"
                onClick={() => { onChange?.(opt); setOpen(false); }}
                style={{
                  display: 'flex', width: '100%', alignItems: 'center',
                  borderRadius: '6px', padding: '8px 12px',
                  textAlign: 'left', border: 'none',
                  background: isSelected ? '#FFFFFF14' : 'transparent',
                  color: isSelected ? '#FFFFFF' : '#FFFFFFCC',
                  fontFamily: FONT, fontSize: '14px', lineHeight: '18px',
                  cursor: 'pointer',
                }}
              >
                {opt}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
