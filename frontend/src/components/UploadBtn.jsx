import { useState, memo } from 'react';
function UploadBtn({ label, onClick }) {
  const [hov, setHov] = useState(false);
  return (<div onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
    style={{display:'flex',alignItems:'center',justifyContent:'center',height:'24px',padding:'0 6px',borderRadius:'6px',cursor:'pointer',background:hov?'#1A1A1A':'#161616',border:`1px solid ${hov?'rgba(255,255,255,0.2)':'rgba(255,255,255,0.08)'}`,outline:'1px solid #00000080',transition:'background 100ms,border-color 100ms'}}>
    <span style={{fontSize:'12px',lineHeight:'16px',color:hov?'rgba(255,255,255,0.8)':'#FFFFFF66'}}>{label}</span></div>);
}
export default memo(UploadBtn);
