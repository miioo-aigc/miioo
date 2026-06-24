import { useState, memo } from 'react';
import SpinnerIcon from './SpinnerIcon';

function GhostBtn({ icon, children, onClick, disabled, loading, fontSize = 14 }) {
  const [hov, setHov] = useState(false);
  const [pressed, setPressed] = useState(false);
  return (
    <div
      role="button"
      tabIndex={0}
      style={{ display: 'flex', flexDirection: 'column', height: '36px', flexShrink: 0, borderRadius: '8px', padding: '1px', boxShadow: '#00000066 3px 3px 8px', backgroundImage: 'linear-gradient(in oklab 148.76deg, oklab(94.7% -0.078 -0.022 / 30%) 3.64%, oklab(75.5% -0.102 -0.072 / 0%) 42.81%), linear-gradient(in oklab 180deg, #FFFFFF14, #FFFFFF14)', outline: '1px solid #00000080', border: 'none', cursor: disabled ? 'not-allowed' : 'pointer', opacity: pressed ? 0.75 : (disabled ? 0.5 : 1), transition: 'opacity 0.1s' }}
      onClick={disabled ? undefined : onClick}
      onMouseEnter={() => !disabled && setHov(true)}
      onMouseLeave={() => { setHov(false); setPressed(false); }}
      onMouseDown={() => !disabled && setPressed(true)}
      onMouseUp={() => setPressed(false)}
    >
      <div style={{ display: 'flex', alignItems: 'center', flexGrow: 1, flexShrink: 1, flexBasis: '0%', borderRadius: '7px', paddingLeft: '15px', paddingRight: '15px', gap: '4px', backgroundColor: pressed ? '#252525' : hov ? '#1D1E1E' : '#161616', transition: 'background-color 0.12s' }}>
        {loading ? <SpinnerIcon color="#FFFFFF" /> : (icon && <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>{icon}</span>)}
        <span style={{ fontSize: `${fontSize}px`, lineHeight: '18px', color: '#FFFFFF', whiteSpace: 'nowrap', fontFamily: '"Alibaba PuHuiTi 2.0", system-ui, sans-serif' }}>{children}</span>
      </div>
    </div>
  );
}

export default memo(GhostBtn);
