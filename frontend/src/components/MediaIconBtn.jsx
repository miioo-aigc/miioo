import { useState, memo } from 'react';

function MediaIconBtn({ children, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <div onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: '6px', cursor: 'pointer', backgroundColor: hov ? 'rgba(255,255,255,0.10)' : 'transparent', transition: 'background-color 0.10s' }}>
      {children}
    </div>
  );
}
export default memo(MediaIconBtn);
