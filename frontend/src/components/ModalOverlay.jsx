import { memo } from 'react';
import { createPortal } from 'react-dom';

function ModalOverlay({ onClose, children }) {
  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.60)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      {children}
    </div>,
    document.body
  );
}

export default memo(ModalOverlay);
