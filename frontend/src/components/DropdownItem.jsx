import { useState, memo } from 'react';
import { FONT } from '../utils/fonts';

function DropdownItem({ label, selected, onClick, icon }) {
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
        paddingLeft: '12px',
        paddingRight: '12px',
        cursor: 'pointer',
        border: 'none',
        textAlign: 'left',
        fontFamily: FONT,
        fontSize: '12px',
        lineHeight: '16px',
        color: selected ? '#FFFFFF' : '#FFFFFFCC',
        background: selected ? '#FFFFFF14' : hovered ? '#FFFFFF0A' : 'transparent',
        transition: 'background 0.15s',
      }}
    >
      {icon && icon}
      {label}
    </button>
  );
}

export default memo(DropdownItem);
