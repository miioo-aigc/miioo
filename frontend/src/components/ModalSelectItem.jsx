import { useState, memo } from 'react';
import { FONT } from '../utils/fonts';

function ModalSelectItem({ label, active, onSelect }) {
  const [hov, setHov] = useState(false);
  return (
    <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)} onClick={onSelect}
      style={{ display: 'flex', alignItems: 'center', height: '32px', paddingInline: '8px', borderRadius: '6px', cursor: 'pointer', backgroundColor: active ? '#FFFFFF14' : hov ? '#FFFFFF0A' : 'transparent', transition: 'background-color 0.10s' }}>
      <span style={{ fontSize: '14px', lineHeight: '18px', color: active ? '#FFFFFF' : 'rgba(255,255,255,0.80)', fontFamily: FONT, fontWeight: active ? 500 : 400 }}>{label}</span>
    </div>
  );
}
export default memo(ModalSelectItem);
