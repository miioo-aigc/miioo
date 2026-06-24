import { useState, memo } from 'react';
import { FONT } from '../utils/fonts';

function RefSlotBtn({ onClick, children }) {
  const [hov, setHov] = useState(false);
  const [pressed, setPressed] = useState(false);
  return (
    <div onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => { setHov(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)} onMouseUp={() => setPressed(false)}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '22px', paddingInline: '6px', borderRadius: '6px', backgroundColor: pressed ? '#1a1a1a' : hov ? '#222323' : '#161616', border: pressed ? '1px solid rgba(255,255,255,0.08)' : hov ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(255,255,255,0.06)', cursor: 'pointer', gap: '4px' }}>
      {children}
    </div>
  );
}

export default memo(RefSlotBtn);
