 import { useState, memo } from 'react';
 
 function SbMediaIconBtn({ children, onClick }) {
   const [hov, setHov] = useState(false);
   return (
     <div
       onClick={onClick}
       onMouseEnter={() => setHov(true)}
       onMouseLeave={() => setHov(false)}
       style={{
         width: "24px", height: "24px",
         display: "flex", alignItems: "center", justifyContent: "center",
         borderRadius: "4px",
         backgroundColor: hov ? "rgba(255,255,255,0.20)" : "rgba(0,0,0,0.50)",
         cursor: "pointer",
         flexShrink: 0,
         transition: "background-color 0.10s",
       }}
     >
       {children}
     </div>
   );
 }
 
 export default memo(SbMediaIconBtn);
