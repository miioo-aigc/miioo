 import { useState } from "react";
 
 export default function IconBtn({ children, onClick }) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setHovered(true)}
      style={{
        width: '28px', height: '28px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
        background: pressed ? 'rgba(255,255,255,0.18)' : hovered ? 'rgba(255,255,255,0.12)' : 'transparent',
        transition: 'background 100ms',
      }}
    >
      {children}
    </div>
  );
}
