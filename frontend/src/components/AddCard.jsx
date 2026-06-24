import { useState, memo } from 'react';
import ChevronDownIcon from './ChevronDownIcon';

function AddCard({ onClick }) {
  const [hov, setHov] = useState(false);
  return (<div onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
    style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:'8px',padding:'24px 16px',borderRadius:'12px',border:`1px dashed ${hov?'rgba(255,255,255,0.25)':'rgba(255,255,255,0.12)'}`,cursor:'pointer',transition:'border-color 0.12s,background 0.12s',background:hov?'rgba(255,255,255,0.02)':'transparent',minHeight:'200px'}}>
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',width:'40px',height:'40px',borderRadius:'10px',background:hov?'#FFFFFF14':'#FFFFFF0A',transition:'background 0.12s'}}>
      <svg width="20" height="20" viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3 8h10" stroke={hov?'#FFFFFF99':'#FFFFFF66'} strokeWidth="1.5" strokeLinecap="round"/></svg>
    </div>
    <span style={{fontSize:'14px',lineHeight:'18px',color:hov?'rgba(255,255,255,0.6)':'rgba(255,255,255,0.4)',fontFamily:'"Alibaba PuHuiTi 2.0", system-ui, sans-serif'}}>新增</span></div>);
}
export default memo(AddCard);
