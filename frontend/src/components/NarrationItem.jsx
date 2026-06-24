 import { useState, useRef } from 'react';
 import { createPortal } from 'react-dom';
 import { FONT } from '../utils/fonts';
 import CharTag from './CharTag';
 
 function NarrationItem({ item, onEdit, onDelete }) {
   const [hovered, setHovered] = useState(false);
   const [closeBtnPos, setCloseBtnPos] = useState(null);
   const labelRef = useRef(null);
 
   function handleMouseEnter() {
     setHovered(true);
     if (labelRef.current) {
       const r = labelRef.current.getBoundingClientRect();
       setCloseBtnPos({ top: r.top - 4, left: r.right - 10 });
     }
   }
 
   function handleMouseLeave() {
     setHovered(false);
     setCloseBtnPos(null);
   }
 
   return (
     <div
       onMouseEnter={handleMouseEnter}
       onMouseLeave={handleMouseLeave}
       style={{ cursor: 'pointer', textAlign: 'left', width: '100%' }}
       onClick={onEdit}
     >
       {item.role && (
         <span ref={labelRef} style={{ display: 'inline-flex', alignItems: 'center' }}>
           {item.role === '旁白'
             ? <span style={{ display: 'inline-flex', alignItems: 'center', paddingInline: '4px', paddingBlock: '0px', borderRadius: '6px', boxShadow: 'inset 0 0 0 1px #FFFFFF14', background: '#8870FF1A', fontFamily: '"AlibabaPuHuiTi 2 55 Regular","Alibaba PuHuiTi 2.0",system-ui,sans-serif', color: '#E8A1FF', fontSize: '14px', lineHeight: '18px', flexShrink: 0 }}>旁白</span>
             : <CharTag name={item.role} />
           }
         </span>
       )}
       {item.lines && (
         <span style={{ fontSize: '14px', lineHeight: '20px', color: 'rgba(255,255,255,0.60)', fontFamily: FONT, wordBreak: 'break-all' }}>
           {item.role ? '\u00A0' : ''}{item.lines}
         </span>
       )}
       {hovered && closeBtnPos && createPortal(
         <button
           type="button"
           onClick={(e) => { e.stopPropagation(); onDelete(); }}
           style={{ position: 'fixed', top: closeBtnPos.top, left: closeBtnPos.left, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '14px', height: '14px', borderRadius: '50%', background: 'rgba(60,60,60,0.95)', border: '1px solid rgba(255,255,255,0.20)', cursor: 'pointer', padding: 0, zIndex: 9999 }}
         >
           <svg width="7" height="7" viewBox="0 0 8 8" fill="none">
             <path d="M6 2L2 6M2 2l4 4" stroke="rgba(255,255,255,0.85)" strokeWidth="1.2" strokeLinecap="round" />
           </svg>
         </button>,
         document.body
       )}
     </div>
   );
 }
 
 export default NarrationItem;
