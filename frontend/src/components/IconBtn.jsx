import { useState, memo } from 'react';
function IconBtn({ children, onClick }) {
  const [hov, setHov] = useState(false);
  return (<div onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
    style={{display:'flex',alignItems:'center',justifyContent:'center',width:'24px',height:'24px',borderRadius:'6px',cursor:'pointer',backgroundColor:hov?'rgba(255,255,255,0.08)':'transparent',transition:'background-color 0.12s'}}>{children}</div>);
}
export default memo(IconBtn);
