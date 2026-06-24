import { useState, memo } from 'react';

function SecondaryBtn({ icon, children, onClick, disabled }) {
  const [hov, setHov] = useState(false);
  const [pressed, setPressed] = useState(false);
  return (
    <div style={{ display: 'flex', alignItems: 'center', height: '36px', flexShrink: 0, borderRadius: '8px', paddingInline: '16px', gap: '4px', boxShadow: '#00000066 3px 3px 8px', backgroundColor: pressed ? '#252525' : hov ? '#1D1E1E' : '#161616', border: '1px solid #FFFFFF0D', outline: '1px solid #00000080', cursor: disabled ? 'not-allowed' : 'pointer', transition: 'background-color 0.12s', opacity: disabled ? 0.5 : 1 }}
      onClick={disabled ? undefined : onClick}
      onMouseEnter={() => !disabled && setHov(true)}
      onMouseLeave={() => { setHov(false); setPressed(false); }}
      onMouseDown={() => !disabled && setPressed(true)}
      onMouseUp={() => setPressed(false)}
    >
      {icon && <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>{icon}</span>}
      <span style={{ fontSize: '14px', lineHeight: '18px', color: '#FFFFFF', whiteSpace: 'nowrap', fontFamily: '"Alibaba PuHuiTi 2.0", system-ui, sans-serif' }}>{children}</span>
    </div>
  );
}

export default memo(SecondaryBtn);
