import { useState, memo } from 'react';
import { FONT } from '../utils/fonts';

function SoundToggle({ enabled, onChange, disabled }) {
  const [hovered, setHovered] = useState(false);
  const isActive = hovered && !disabled;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => !disabled && onChange(!enabled)}
      onMouseEnter={() => !disabled && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        height: '32px',
        paddingLeft: '12px',
        paddingRight: '6px',
        borderRadius: '8px',
        justifyContent: 'space-between',
        flexShrink: 0,
        border: '1px solid #FFFFFF14',
        cursor: disabled ? 'not-allowed' : 'pointer',
        background: isActive ? '#222222' : '#1D1E1E',
        outline: '1px solid #00000080',
        transition: 'background 0.2s',
        opacity: disabled ? 0.45 : 1,
      }}
    >
      <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', color: '#FFFFFFCC' }}>声音</span>
      <div style={{
        width: '36px',
        height: '20px',
        display: 'flex',
        alignItems: 'center',
        borderRadius: '10px',
        padding: '2px',
        justifyContent: enabled ? 'flex-end' : 'flex-start',
        flexShrink: 0,
        background: enabled ? '#39BA69' : '#FFFFFF33',
        transition: 'background 0.2s, justify-content 0.2s',
      }}>
        <div style={{ flexShrink: 0, borderRadius: '50%', background: 'white', width: '16px', height: '16px' }} />
      </div>
    </button>
  );
}

export default memo(SoundToggle);
