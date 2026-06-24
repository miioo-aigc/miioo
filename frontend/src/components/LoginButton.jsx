import { useState, memo } from 'react';
import { FONT, FONT_MEDIUM } from '../utils/fonts';

function LoginButton({ onClick }) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  return (
    <button className="flex flex-col h-[36px] shrink-0 rounded-full p-px relative overflow-hidden cursor-pointer border-0 bg-transparent"
      style={{ boxShadow: pressed ? 'none' : '#00000066 3px 3px 8px', transition: 'box-shadow 120ms ease' }}
      onClick={onClick} onMouseEnter={() => setHovered(true)} onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)} onMouseUp={() => setPressed(false)}>
      <div className="flex items-center flex-1 self-stretch rounded-full" style={{ paddingLeft: '16px', paddingRight: '16px', gap: '6px', backgroundColor: pressed ? '#28B0CC' : hovered ? '#32CDE8' : '#2DC3E1', transition: 'background-color 120ms ease' }}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
          <path d="M10.667 3.333C10.667 4.806 9.473 6 8 6C6.527 6 5.333 4.806 5.333 3.333C5.333 1.861 6.527 0.667 8 0.667C9.473 0.667 10.667 1.861 10.667 3.333Z" stroke="white" strokeLinejoin="round" />
          <path d="M8 9.333C5.054 9.333 2.667 11.721 2.667 14.667H13.333C13.333 11.721 10.946 9.333 8 9.333Z" stroke="white" strokeLinejoin="round" />
        </svg>
        <span style={{ fontFamily: FONT_MEDIUM, fontWeight: 500, fontSize: '14px', lineHeight: '18px', color: '#090909', whiteSpace: 'nowrap' }}>登录</span>
      </div>
    </button>
  );
}
export default memo(LoginButton);
