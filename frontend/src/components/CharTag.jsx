import { useState, memo } from 'react';

function CharTag({ name, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <span onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ display: 'inline-flex', alignItems: 'center', paddingInline: '4px', borderRadius: '4px', fontSize: '14px', lineHeight: '18px', backgroundColor: hov ? 'rgba(226,226,75,0.25)' : 'rgba(226,226,75,0.15)', color: '#E2E24B', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)', fontFamily: '"Alibaba PuHuiTi 2.0", system-ui, sans-serif', flexShrink: 0, cursor: onClick ? 'pointer' : 'default', transition: 'background-color 0.12s' }}>
      {name}
    </span>
  );
}
export default memo(CharTag);
