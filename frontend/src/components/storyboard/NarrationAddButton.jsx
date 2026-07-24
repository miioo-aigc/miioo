import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif";

export default function NarrationAddButton({ onClick, tooltip = '新增角色台词' }) {
  const [hovered, setHovered] = useState(false);
  const [tooltipPos, setTooltipPos] = useState(null);
  const btnRef = useRef(null);

  function handleMouseEnter() {
    setHovered(true);
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setTooltipPos({ x: rect.left + rect.width / 2, y: rect.top });
    }
  }

  return (
    <div style={{ flexShrink: 0 }}>
      <button
        ref={btnRef}
        type="button"
        onClick={onClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => { setHovered(false); setTooltipPos(null); }}
        aria-label={tooltip}
        title={tooltip}
        style={{ width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: hovered ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: '4px', cursor: 'pointer', padding: 0, transition: 'background 100ms' }}
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
          <path d="M5 2v6M2 5h6" stroke="rgba(255,255,255,0.60)" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      </button>
      {hovered && tooltipPos && createPortal(
        <div style={{ position: 'fixed', left: tooltipPos.x, top: tooltipPos.y, transform: 'translate(-50%, calc(-100% - 6px))', whiteSpace: 'nowrap', background: '#2A2A2A', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '6px', padding: '5px 8px', fontSize: '12px', lineHeight: '16px', color: 'rgba(255,255,255,0.60)', fontFamily: FONT, pointerEvents: 'none', zIndex: 9999, boxShadow: '0 4px 12px rgba(0,0,0,0.4)' }}>
          {tooltip}
        </div>,
        document.body
      )}
    </div>
  );
}
