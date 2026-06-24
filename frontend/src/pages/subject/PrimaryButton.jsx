 import { useState } from "react";
 import { FONT_MEDIUM } from "../../utils/fonts";
 import DotsLoading from "../../components/DotsLoading";
 
 export default 
 function PrimaryButton({ icon, label, onClick, disabled = false, loading = false }) {
   const dimmed = disabled || loading;
   const [pressed, setPressed] = useState(false);
   const [hovered, setHovered] = useState(false);
   const interactive = !dimmed;
 
   const getOpacity = () => {
     if (dimmed) return 0.45;
     if (pressed) return 0.75;
     if (hovered) return 0.88;
     return 1;
   };
 
   return (
     <div
       className="flex items-center shrink-0 rounded-[8px] gap-[4px] px-[16px] border border-solid border-[#FFFFFF33] bg-origin-border [outline:1px_solid_#00000080]"
       style={{
         height: '36px',
         backgroundColor: '#2DC3E1',
         backgroundImage: 'linear-gradient(in oklab 107.51deg, oklab(84.6% -0.114 0.031 / 30%) 8.14%, oklab(84.6% -0.114 0.031 / 0%) 54.48%)',
         opacity: getOpacity(),
         transform: dimmed ? 'none' : pressed ? 'scale(0.97)' : 'scale(1)',
         cursor: interactive ? 'pointer' : 'not-allowed',
         transition: 'opacity 0.15s, transform 0.1s',
       }}
       onMouseEnter={() => { if (interactive) setHovered(true); }}
       onMouseLeave={() => { if (interactive) { setHovered(false); setPressed(false); } }}
       onMouseDown={() => { if (interactive) setPressed(true); }}
       onMouseUp={() => { if (interactive) setPressed(false); }}
       onClick={interactive ? onClick : undefined}
     >
       {loading ? <DotsLoading size={3} color="#090909" gap={3} /> : icon}
       <span
         className="inline-block w-max shrink-0 font-medium"
         style={{ fontFamily: FONT_MEDIUM, fontSize: '14px', lineHeight: '18px', color: '#090909' }}
       >
         {loading ? '生成中…' : label}
       </span>
     </div>
   );
 }
