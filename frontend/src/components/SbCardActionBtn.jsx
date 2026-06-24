import { useState, useRef, memo } from 'react';
import { createPortal } from 'react-dom';

function SbCardActionBtn({ btn, index, onAdd, onCopy, onDeleteRequest, onDragHandlePress }) {
  const [hov, setHov] = useState(false);
  const [tooltipPos, setTooltipPos] = useState(null);
  const btnRef = useRef(null);

  function handleMouseEnter() {
    setHov(true);
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setTooltipPos({ top: rect.top + rect.height / 2, left: rect.right + 6 });
    }
  }

  function handleMouseLeave() {
    setHov(false);
    setTooltipPos(null);
  }

  return (
    <>
      <div
        ref={btnRef}
        onMouseDown={btn.key === 'drag' ? onDragHandlePress : undefined}
        onClick={() => {
          if (btn.key === 'add') onAdd?.();
          if (btn.key === 'copy') onCopy?.();
          if (btn.key === 'delete') onDeleteRequest?.();
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{
          width: '24px',
          height: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '4px',
          cursor: btn.key === 'drag' ? 'grab' : 'pointer',
          backgroundColor: hov ? 'rgba(255,255,255,0.08)' : 'transparent',
          animation: 'slideDownBounce 300ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
          animationDelay: `${index * 50}ms`,
          opacity: 0,
          transition: 'background-color 0.10s',
        }}
      >
        {btn.icon}
      </div>
      {hov && tooltipPos && createPortal(
        <div
          style={{
            position: 'fixed',
            top: tooltipPos.top,
            left: tooltipPos.left,
            transform: 'translateY(-50%)',
            zIndex: 9999,
            pointerEvents: 'none',
            backgroundColor: '#090909',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '4px',
            padding: '5px 8px',
            fontSize: '12px',
            lineHeight: '16px',
            color: 'rgba(255,255,255,0.80)',
            fontFamily: '"Alibaba PuHuiTi 2.0", system-ui, sans-serif',
            whiteSpace: 'nowrap',
            boxShadow: '0 4px 24px var(--color-shadow)',
          }}
        >
          {btn.label}
        </div>,
        document.body
      )}
    </>
  );
}


export default memo(SbCardActionBtn);
