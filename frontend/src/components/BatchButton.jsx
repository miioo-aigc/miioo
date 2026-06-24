import { useState, memo } from 'react';
import { FONT } from '../utils/fonts';

function BatchButton({ onClick }) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '36px',
        flexShrink: 0,
        borderRadius: '8px',
        padding: '1px',
        boxShadow: '#00000066 3px 3px 8px',
        backgroundImage: pressed
          ? 'linear-gradient(in oklab 148.76deg, oklab(94.7% -0.078 -0.022 / 50%) 3.64%, oklab(75.5% -0.102 -0.072 / 0%) 42.81%), linear-gradient(in oklab 180deg, #FFFFFF1E, #FFFFFF1E)'
          : hovered
          ? 'linear-gradient(in oklab 148.76deg, oklab(94.7% -0.078 -0.022 / 40%) 3.64%, oklab(75.5% -0.102 -0.072 / 0%) 42.81%), linear-gradient(in oklab 180deg, #FFFFFF1A, #FFFFFF1A)'
          : 'linear-gradient(in oklab 148.76deg, oklab(94.7% -0.078 -0.022 / 30%) 3.64%, oklab(75.5% -0.102 -0.072 / 0%) 42.81%), linear-gradient(in oklab 180deg, #FFFFFF14, #FFFFFF14)',
        outline: '1px solid #00000080',
        border: 'none',
        cursor: 'pointer',
        transition: 'background-image 0.15s, transform 0.1s',
        transform: pressed ? 'scale(0.97)' : 'scale(1)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          flex: 1,
          borderRadius: '7px',
          paddingLeft: '15px',
          paddingRight: '15px',
          gap: '4px',
          backgroundColor: pressed ? '#1A1A1A' : hovered ? '#1C1C1C' : '#161616',
          transition: 'background-color 0.15s',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
          <path d="M11.333 1.667H2.667C2.114 1.667 1.667 2.114 1.667 2.667V11.333C1.667 11.886 2.114 12.333 2.667 12.333H11.333C11.886 12.333 12.333 11.886 12.333 11.333V2.667C12.333 2.114 11.886 1.667 11.333 1.667Z" stroke="#FFFFFF" strokeLinejoin="round" />
          <path d="M14.667 4.334V14C14.667 14.368 14.368 14.667 14 14.667H4.334" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M4.333 6.829L6.333 8.67L9.667 5.24" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span style={{ fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: '#FFFFFF', whiteSpace: 'nowrap' }}>
          批量操作
        </span>
      </div>
    </button>
  );
}

export default memo(BatchButton);
