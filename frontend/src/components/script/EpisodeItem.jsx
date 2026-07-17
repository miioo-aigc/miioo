import { useState } from 'react';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif";

export default function EpisodeItem({ title, level, isSelected, onClick }) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        justifyContent: 'center',
        height: '36px',
        paddingLeft: '16px',
        paddingRight: '16px',
        borderRadius: '8px',
        alignSelf: 'stretch',
        flexShrink: 0,
        cursor: 'pointer',
        backgroundColor: isSelected ? '#FFFFFF0D' : hovered ? '#FFFFFF0A' : 'transparent',
        transition: 'background-color 0.15s',
        border: 'none',
        outline: 'none',
        textAlign: 'left',
      }}
    >
      <span
        style={{
          fontFamily: FONT,
          fontSize: '14px',
          lineHeight: '18px',
          color: isSelected ? '#FFFFFF' : '#FFFFFF99',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          maxWidth: '100%',
          transition: 'color 0.15s',
          paddingLeft: level === 2 ? '16px' : '0px',
        }}
      >
        {title}
      </span>
    </button>
  );
}
