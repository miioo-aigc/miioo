import { useState, memo } from 'react';
function PlainBtn({ children, onClick, danger }) {
  const [hov, setHov] = useState(false);
  const [pressed, setPressed] = useState(false);
  const color = danger ? '#F96D6D' : 'rgba(255,255,255,0.60)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', height: '32px', paddingInline: '6px', gap: '4px', borderRadius: '4px', cursor: 'pointer', backgroundColor: pressed ? 'rgba(255,255,255,0.10)' : hov ? 'rgba(255,255,255,0.06)' : 'transparent', transition: 'background-color 0.10s' }}
      onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => { setHov(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)} onMouseUp={() => setPressed(false)}>
      <span style={{ fontSize: '13px', lineHeight: '16px', color, whiteSpace: 'nowrap', fontFamily: "'Alibaba PuHuiTi 2.0', system-ui, sans-serif" }}>{children}</span>
    </div>
  );
}
export default memo(PlainBtn);
