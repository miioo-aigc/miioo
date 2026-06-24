import { useState, memo } from 'react';
import { FONT, FONT_MEDIUM } from '../utils/fonts';

function GhostButton({ children, onClick, danger }) {
  const [hov, setHov] = useState(false);
  const [pressed, setPressed] = useState(false);
  const color = danger ? '#F96D6D' : '#FFFFFF';
  return (
    <div style={{ display: 'flex', alignItems: 'center', height: '36px', borderRadius: '8px', paddingInline: '16px', gap: '4px', cursor: 'pointer', backgroundColor: pressed ? '#1a1a1a' : hov ? '#1e1e1e' : '#161616', border: '1px solid rgba(255,255,255,0.05)', outline: '1px solid #00000080', transition: 'background-color 0.10s' }}
      onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => { setHov(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)} onMouseUp={() => setPressed(false)}>
      <span style={{ fontSize: '14px', lineHeight: '18px', color, fontFamily: FONT_MEDIUM, fontWeight: 500, whiteSpace: 'nowrap' }}>{children}</span>
    </div>
  );
}
export default memo(GhostButton);
