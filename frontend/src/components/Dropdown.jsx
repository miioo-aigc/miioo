import { useRef, useEffect, memo } from 'react';

function Dropdown({ trigger, children, open, onClose, dropUp = true }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, onClose]);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {trigger}
      {open && (
        <div
          style={{
            position: 'absolute',
            zIndex: 50,
            left: 0,
            [dropUp ? 'bottom' : 'top']: 'calc(100% + 4px)',
            borderRadius: '8px',
            overflow: 'hidden',
            background: '#1D1E1E',
            border: '1px solid #FFFFFF0D',
            boxShadow: '0px 4px 16px #00000066',
            minWidth: '112px',
            padding: '4px',
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export default memo(Dropdown);
