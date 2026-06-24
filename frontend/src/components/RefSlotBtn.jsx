import { useState, memo } from 'react';
import { FONT } from '../utils/fonts';

function RefSlotBtn({ onClick, children }) {
  const [hov, setHov] = useState(false);
  const [pressed, setPressed] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => { setHov(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '22px', paddingInline: '6px', borderRadius: '6px',
        backgroundColor: pressed ? '#1a1a1a' : hov ? '#222323' : '#161616',
        border: '1px solid rgba(255,255,255,0.08)', outline: '1px solid #00000080',
        cursor: 'pointer', fontSize: '12px', lineHeight: '14px',
        color: hov ? 'rgba(255,255,255,0.70)' : 'rgba(255,255,255,0.40)',
        fontFamily: FONT, whiteSpace: 'nowrap', transition: 'background-color 0.10s, color 0.10s',
      }}
    >
      {children}
    </div>
  );
}

export default memo(RefSlotBtn);
