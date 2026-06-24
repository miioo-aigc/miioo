import { memo } from 'react';
function RadioOption({ label, checked, onChange }) {
  return (<div onClick={onChange} style={{display:'flex',alignItems:'center',gap:'8px',cursor:'pointer',padding:'4px 0'}}>
    <div style={{width:'18px',height:'18px',borderRadius:'9px',border:checked?'6px solid #2DC3E1':'1px solid rgba(255,255,255,0.3)',transition:'border 0.12s',flexShrink:0}}/>
    <span style={{fontSize:'14px',lineHeight:'18px',color:'#FFFFFF'}}>{label}</span></div>);
}
export default memo(RadioOption);
