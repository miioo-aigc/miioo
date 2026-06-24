import { useState, memo } from 'react';
import { FONT } from '../utils/fonts';

function RefModeDropdownItem({ label, icon, selected, onClick }) {
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
        gap: '4px',
        width: '100%',
        paddingLeft: '12px',
        paddingRight: '12px',
        paddingTop: '8px',
        paddingBottom: '8px',
        borderRadius: '6px',
        cursor: 'pointer',
        border: 'none',
        textAlign: 'left',
        fontFamily: FONT,
        fontSize: '14px',
        lineHeight: '18px',
        color: selected ? '#FFFFFFCC' : '#FFFFFF99',
        background: selected ? '#FFFFFF0D' : hovered ? '#FFFFFF0A' : 'transparent',
        transition: 'background 0.15s',
      }}
    >
      {icon}
      <span style={{ flex: 1 }}>{label}</span>
    </button>
  );
}

export default memo(RefModeDropdownItem);
