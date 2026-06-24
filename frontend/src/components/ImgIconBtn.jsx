import { useState, memo } from 'react';

function ImgIconBtn({ children, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <div onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '22px', height: '22px', borderRadius: '4px', cursor: 'pointer', backgroundColor: hov ? 'rgba(0,0,0,0.40)' : 'transparent', transition: 'background-color 0.10s' }}>
      {children}
    </div>
  );
}
export default memo(ImgIconBtn);
