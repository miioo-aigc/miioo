import { useState } from "react";
import { FONT } from "../../utils/fonts";

export default 
function AddCard({ onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      className="[font-synthesis:none] flex flex-col items-center justify-center rounded-xl cursor-pointer border border-dashed"
      style={{
        aspectRatio: '200/246',
        borderColor: hovered ? '#FFFFFF40' : '#FFFFFF26',
        backgroundColor: hovered ? '#FFFFFF05' : 'transparent',
        gap: '6px',
        transition: 'border-color 0.15s, background-color 0.15s',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
    >
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
        <path d="M10 4V16M4 10H16" stroke={hovered ? '#FFFFFF66' : '#FFFFFF33'} strokeWidth="1.5" strokeLinecap="round" style={{ transition: 'stroke 0.15s' }} />
      </svg>
      <span style={{ fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: hovered ? '#FFFFFF66' : '#FFFFFF33', transition: 'color 0.15s' }}>
        新增
      </span>
    </div>
  );
}
