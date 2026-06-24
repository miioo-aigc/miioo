import { useState, memo } from 'react';
import { FONT } from '../utils/fonts';

function UploadMenuItem({ label, icon, onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        width: '100%',
        height: '32px',
        paddingLeft: '10px',
        paddingRight: '10px',
        borderRadius: '6px',
        cursor: 'pointer',
        border: 'none',
        textAlign: 'left',
        fontFamily: FONT,
        fontSize: '12px',
        lineHeight: '16px',
        color: '#FFFFFFCC',
        background: hovered ? '#FFFFFF0A' : 'transparent',
        transition: 'background 0.15s',
      }}
    >
      {icon}
      {label}
    </button>
  );
}

export default memo(UploadMenuItem);
