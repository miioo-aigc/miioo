import { useState, memo } from 'react';
import { FONT } from '../utils/fonts';

function ModalGhostBtn({ children, onClick }) {
  const [hov, setHov] = useState(false);
  const [pressed, setPressed] = useState(false);
  return (
    <div style={{ display: 'flex', alignItems: 'center', height: '36px', flexShrink: 0, borderRadius: '8px', paddingInline: '16px', gap: '4px', boxShadow: 'rgba(0,0,0,0.40) 3px 3px 8px', backgroundColor: pressed ? '#1a1a1a' : hov ? '#1e1e1e' : '#161616', border: '1px solid rgba(255,255,255,0.05)', outline: '1px solid #00000080', cursor: 'pointer', transition: 'background-color 0.10s' }}
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => { setHov(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
    >
      <span style={{ fontSize: '14px', lineHeight: '18px', color: 'rgba(255,255,255,0.60)', whiteSpace: 'nowrap', fontFamily: FONT }}>{children}</span>
    </div>
  );
}

export default memo(ModalGhostBtn);
