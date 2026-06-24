import { useState, memo } from 'react';
import SpinnerIcon from './SpinnerIcon';

function PrimaryBtn({ icon, children, onClick, disabled, loading }) {
  const [hov, setHov] = useState(false);
  const [pressed, setPressed] = useState(false);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '36px', flexShrink: 0, borderRadius: '8px', padding: '1px', boxShadow: '#00000066 3px 3px 8px', backgroundImage: pressed ? 'linear-gradient(in oklab 148.76deg, oklab(94.7% -0.078 -0.022 / 50%) 3.64%, oklab(75.5% -0.102 -0.072 / 0%) 42.81%), linear-gradient(in oklab 180deg, #FFFFFF1E, #FFFFFF1E)' : hov ? 'linear-gradient(in oklab 148.76deg, oklab(94.7% -0.078 -0.022 / 45%) 3.64%, oklab(75.5% -0.102 -0.072 / 0%) 42.81%), linear-gradient(in oklab 180deg, #FFFFFF1E, #FFFFFF1E)' : 'linear-gradient(in oklab 148.76deg, oklab(94.7% -0.078 -0.022 / 30%) 3.64%, oklab(75.5% -0.102 -0.072 / 0%) 42.81%), linear-gradient(in oklab 180deg, #FFFFFF14, #FFFFFF14)', outline: '1px solid #00000080', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1, transition: 'opacity 0.12s' }}
      onClick={disabled ? undefined : onClick}
      onMouseEnter={() => !disabled && setHov(true)}
      onMouseLeave={() => { setHov(false); setPressed(false); }}
      onMouseDown={() => !disabled && setPressed(true)}
      onMouseUp={() => setPressed(false)}
    >
      <div style={{ display: 'flex', alignItems: 'center', flex: 1, borderRadius: '7px', paddingInline: '15px', gap: '4px', backgroundColor: pressed ? '#1a1a1a' : hov ? '#1e1e1e' : '#161616', transition: 'background-color 0.10s' }}>
        {loading ? <SpinnerIcon color="#FFFFFF" /> : (icon && <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>{icon}</span>)}
        <span style={{ fontSize: '14px', lineHeight: '18px', color: '#FFFFFF', whiteSpace: 'nowrap', fontFamily: '"Alibaba PuHuiTi 2.0", system-ui, sans-serif' }}>{children}</span>
      </div>
    </div>
  );
}

export default memo(PrimaryBtn);
