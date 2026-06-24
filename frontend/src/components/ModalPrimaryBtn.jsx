import { useState, memo } from 'react';
import { FONT_MEDIUM } from '../utils/fonts';

function ModalPrimaryBtn({ children, onClick }) {
  const [hov, setHov] = useState(false);
  const [pressed, setPressed] = useState(false);
  return (
    <div style={{ display: 'flex', alignItems: 'center', height: '36px', flexShrink: 0, borderRadius: '8px', paddingInline: '16px', gap: '4px', backgroundColor: pressed ? '#28b0cc' : hov ? '#32cde8' : '#2DC3E1', backgroundImage: 'linear-gradient(in oklab 107.5deg, oklab(84.6% -0.114 0.031 / 30%) 8.14%, oklab(84.6% -0.114 0.031 / 0%) 54.48%)', backgroundOrigin: 'border-box', border: '1px solid #FFFFFF33', outline: '1px solid #00000080', cursor: 'pointer', transition: 'background-color 0.10s' }}
      onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => { setHov(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)} onMouseUp={() => setPressed(false)}>
      <span style={{ fontSize: '14px', lineHeight: '18px', color: '#090909', fontFamily: FONT_MEDIUM, fontWeight: 500, whiteSpace: 'nowrap' }}>{children}</span>
    </div>
  );
}
export default memo(ModalPrimaryBtn);
