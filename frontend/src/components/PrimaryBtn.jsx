import { useState, memo } from 'react';
import SpinnerIcon from './SpinnerIcon';

function PrimaryBtn({ icon, children, onClick, disabled, loading }) {
  const [hov, setHov] = useState(false);
  const [pressed, setPressed] = useState(false);
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        height: '36px',
        flexShrink: 0,
        borderRadius: '8px',
        paddingInline: '16px',
        gap: '4px',
        backgroundColor: pressed ? '#28b0cc' : hov ? '#32cde8' : '#2DC3E1',
        backgroundImage: 'linear-gradient(in oklab 107.5deg, oklab(84.6% -0.114 0.031 / 30%) 8.14%, oklab(84.6% -0.114 0.031 / 0%) 54.48%)',
        backgroundOrigin: 'border-box',
        border: '1px solid #FFFFFF33',
        outline: '1px solid #00000080',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'background-color 0.10s, opacity 0.12s',
      }}
      onClick={disabled ? undefined : onClick}
      onMouseEnter={() => !disabled && setHov(true)}
      onMouseLeave={() => { setHov(false); setPressed(false); }}
      onMouseDown={() => !disabled && setPressed(true)}
      onMouseUp={() => setPressed(false)}
    >
      {loading ? <SpinnerIcon color="#090909" /> : (icon && <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>{icon}</span>)}
      <span style={{ fontSize: '14px', lineHeight: '18px', color: '#090909', fontFamily: '"Alibaba PuHuiTi 2.0", system-ui, sans-serif' }}>
        {children}
      </span>
    </div>
  );
}

export default memo(PrimaryBtn);
