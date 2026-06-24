import { useState, memo } from 'react';

function MenuPopupItem({ label, onClick, showExternalIcon = false }) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  return (
    <button type="button" className="flex items-center w-full rounded-[6px] border-0 bg-transparent text-left cursor-pointer"
      style={{ padding: '8px 12px', gap: '4px', justifyContent: showExternalIcon ? 'space-between' : 'flex-start', backgroundColor: pressed ? '#FFFFFF14' : hovered ? '#FFFFFF0D' : 'transparent', transition: 'background-color 120ms ease, color 120ms ease' }}
      onClick={onClick} onMouseEnter={() => setHovered(true)} onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)} onMouseUp={() => setPressed(false)}>
      <div className="w-fit shrink-0 font-['AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif]"
        style={{ fontSize: '14px', lineHeight: '18px', color: pressed || hovered ? '#FFFFFF' : '#FFFFFFCC' }}>
        {label}
      </div>
      {showExternalIcon && (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
          <path d="M4.5 11.5L11.5 4.5" stroke="#FFFFFF80" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M7 4.5H11.5V9" stroke="#FFFFFF80" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}
export default memo(MenuPopupItem);
