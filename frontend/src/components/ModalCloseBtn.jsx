import { useState, memo } from 'react';

function ModalCloseBtn({ onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <div style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px', cursor: 'pointer', flexShrink: 0, backgroundColor: hov ? 'rgba(255,255,255,0.08)' : 'transparent', transition: 'background-color 0.10s' }}
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M2.667 2.667L13.333 13.333" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M2.667 13.333L13.333 2.667" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

export default memo(ModalCloseBtn);
