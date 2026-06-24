 import { useState, useRef } from 'react';
 import ParamSelect from './ParamSelect';
 
 function ParamTrigger({ field, label, value, isActive, triggerRefs, onToggle, onClose, onUpdate }) {
   const [hov, setHov] = useState(false);
   const [pressed, setPressed] = useState(false);
 
   return (
     <div
       ref={(el) => { triggerRefs.current[field] = el; }}
       onClick={onToggle}
       onMouseEnter={() => setHov(true)}
       onMouseLeave={() => { setHov(false); setPressed(false); }}
       onMouseDown={() => setPressed(true)}
       onMouseUp={() => setPressed(false)}
       style={{
         position: 'relative',
         display: 'flex',
         alignItems: 'center',
         gap: '2px',
         height: '22px',
         paddingInline: '6px',
         borderRadius: '6px',
         cursor: 'pointer',
         backgroundColor: pressed
           ? 'rgba(255,255,255,0.10)'
           : isActive
           ? 'rgba(255,255,255,0.08)'
           : hov
           ? 'rgba(255,255,255,0.06)'
           : 'transparent',
         border: `1px solid ${isActive ? 'rgba(255,255,255,0.18)' : hov ? 'rgba(255,255,255,0.10)' : 'transparent'}`,
         transition: 'background-color 0.12s, border-color 0.12s',
         userSelect: 'none',
       }}
     >
       <span style={{
         fontSize: '12px',
         color: hov || isActive ? 'rgba(255,255,255,0.50)' : 'rgba(255,255,255,0.35)',
         fontFamily: '"Alibaba PuHuiTi 2.0", system-ui, sans-serif',
         transition: 'color 0.12s',
         whiteSpace: 'nowrap',
       }}>
         {label}：
       </span>
       <span style={{
         fontSize: '12px',
         color: hov || isActive ? '#FFFFFF' : 'rgba(255,255,255,0.80)',
         fontFamily: '"Alibaba PuHuiTi 2.0", system-ui, sans-serif',
         transition: 'color 0.12s',
         whiteSpace: 'nowrap',
       }}>
         {value || '\u2014'}
       </span>
       {isActive && (
         <ParamSelect
           field={field}
           value={value}
           onChange={onUpdate}
           onClose={onClose}
           triggerRef={{ current: triggerRefs.current[field] }}
         />
       )}
     </div>
   );
 }
 
 export default ParamTrigger;
