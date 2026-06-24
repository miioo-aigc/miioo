import { useState, memo } from 'react';
import { FONT } from '../utils/fonts';

function ModalActionBtn({ icon, label, onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        flex: 1,
        height: '40px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '4px',
        borderRadius: '8px',
        border: '1px solid #FFFFFF1F',
        backgroundColor: hovered ? '#FFFFFF1F' : '#FFFFFF14',
        cursor: 'pointer',
        transition: 'background-color 0.15s',
      }}
    >
      {icon}
      <span style={{ fontFamily: FONT, fontSize: '13px', lineHeight: '16px', letterSpacing: '0.01em', color: '#FFFFFF99' }}>{label}</span>
    </button>
  );
}

export default memo(ModalActionBtn);
