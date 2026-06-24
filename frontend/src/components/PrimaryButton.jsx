import { useState, memo } from 'react';
import SpinnerIcon from './SpinnerIcon';

function PrimaryButton({ icon, label, onClick, disabled = false, loading = false }) {
  const [hov, setHov] = useState(false);
  return (
    <div onClick={disabled ? undefined : onClick} onMouseEnter={() => !disabled && setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ display: 'flex', alignItems: 'center', height: '36px', borderRadius: '8px', paddingInline: '16px', gap: '4px', cursor: disabled ? 'not-allowed' : 'pointer', backgroundColor: hov ? '#323333' : '#2A2B2B', transition: 'background-color 0.12s', opacity: disabled ? 0.5 : 1, border: '1px solid rgba(255,255,255,0.08)', outline: '1px solid #00000080' }}>
      {loading ? <SpinnerIcon color="#FFFFFF" /> : icon ? <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>{icon}</span> : null}
      {label && <span style={{ fontSize: '14px', lineHeight: '18px', color: '#FFFFFF', whiteSpace: 'nowrap', fontFamily: '"Alibaba PuHuiTi 2.0", system-ui, sans-serif' }}>{label}</span>}
    </div>
  );
}
export default memo(PrimaryButton);
