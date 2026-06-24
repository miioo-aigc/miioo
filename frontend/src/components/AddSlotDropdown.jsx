 import { useState, useRef, useEffect } from 'react';
 import { createPortal } from 'react-dom';
 
 function AddSlotDropdown({ anchorRef, onUpload, onAssetPicker, onClose }) {
   const menuRef = useRef(null);
   const [hovIdx, setHovIdx] = useState(null);
 
   useEffect(() => {
     function onDown(e) {
       if (menuRef.current && !menuRef.current.contains(e.target) &&
           anchorRef.current && !anchorRef.current.contains(e.target)) {
         onClose();
       }
     }
     document.addEventListener('mousedown', onDown);
     return () => document.removeEventListener('mousedown', onDown);
   }, [onClose, anchorRef]);
 
   const items = [
     { label: '本地上传', action: onUpload },
     { label: '从资产库选择', action: onAssetPicker },
   ];
 
   const anchor = anchorRef.current?.getBoundingClientRect();
   if (!anchor) return null;
 
   return createPortal(
     <div
       ref={menuRef}
       style={{
         position: 'fixed',
         top: anchor.bottom + 4,
         left: anchor.left,
         zIndex: 9999,
         backgroundColor: '#1D1E1E',
         border: '1px solid rgba(255,255,255,0.10)',
         borderRadius: '8px',
         padding: '4px',
         boxShadow: '0px 4px 16px rgba(0,0,0,0.50)',
         minWidth: '120px',
         display: 'flex',
         flexDirection: 'column',
         gap: '2px',
       }}
     >
       {items.map((item, i) => (
         <div
           key={i}
           onMouseEnter={() => setHovIdx(i)}
           onMouseLeave={() => setHovIdx(null)}
           onMouseDown={(e) => { e.preventDefault(); item.action(); onClose(); }}
           style={{
             height: '32px',
             display: 'flex',
             alignItems: 'center',
             paddingInline: '10px',
             borderRadius: '6px',
             cursor: 'pointer',
             backgroundColor: hovIdx === i ? 'rgba(255,255,255,0.08)' : 'transparent',
             fontSize: '13px',
             color: hovIdx === i ? '#FFFFFF' : 'rgba(255,255,255,0.70)',
             fontFamily: '"Alibaba PuHuiTi 2.0", system-ui, sans-serif',
             whiteSpace: 'nowrap',
             transition: 'background-color 0.10s, color 0.10s',
           }}
         >
           {item.label}
         </div>
       ))}
     </div>,
     document.body
   );
 }
 
 export default AddSlotDropdown;
