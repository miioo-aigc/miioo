import { createPortal } from 'react-dom';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif";

const EMOTIONS = [
  { key: 'neutral', label: '中性', tone: 'positive' },
  { key: 'afraid', label: '害怕', tone: 'negative' },
  { key: 'happy', label: '开心', tone: 'positive' },
  { key: 'sad', label: '难过', tone: 'negative' },
  { key: 'lively', label: '生动', tone: 'positive' },
  { key: 'angry', label: '生气', tone: 'negative' },
  { key: 'surprised', label: '惊讶', tone: 'positive' },
  { key: 'disgusted', label: '厌恶', tone: 'negative' },
];

const TONE_STYLES = {
  positive: {
    background: 'rgba(122, 229, 185, 0.10)',
    border: 'rgba(122, 229, 185, 0.20)',
    color: '#7AE5B9',
    activeBackground: 'rgba(122, 229, 185, 0.20)',
  },
  negative: {
    background: 'rgba(247, 95, 95, 0.10)',
    border: 'rgba(247, 95, 95, 0.20)',
    color: '#F75F5F',
    activeBackground: 'rgba(247, 95, 95, 0.20)',
  },
};

export { EMOTIONS };

export default function CreationDubbingEmotionMenu({ position, selectedEmotion, onSelect }) {
  if (!position) return null;

  return createPortal(
    <div
      role="menu"
      aria-label="情绪选择"
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        zIndex: 10000,
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '4px',
        width: '166px',
        padding: '8px',
        boxSizing: 'border-box',
        borderRadius: '8px',
        background: '#1D1E1E',
        border: '1px solid #FFFFFF0D',
        boxShadow: '#00000066 0px 4px 16px',
        fontFamily: FONT,
      }}
    >
      {EMOTIONS.map((emotion) => {
        const tone = TONE_STYLES[emotion.tone];
        const selected = selectedEmotion === emotion.key;
        return (
          <button
            key={emotion.key}
            type="button"
            role="menuitem"
            aria-pressed={selected}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onSelect(emotion)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: 0,
              height: '26px',
              padding: '0 22px',
              border: 'none',
              boxShadow: `inset 0 0 0 1px ${selected ? tone.color : tone.border}`,
              borderRadius: '6px',
              background: selected ? tone.activeBackground : tone.background,
              color: tone.color,
              fontFamily: FONT,
              fontSize: '14px',
              lineHeight: '18px',
              cursor: 'pointer',
              outline: 'none',
              transition: 'background-color 140ms ease, border-color 140ms ease, transform 140ms ease',
            }}
            onMouseEnter={(event) => {
              event.currentTarget.style.background = tone.activeBackground;
              event.currentTarget.style.boxShadow = `inset 0 0 0 1px ${tone.color}`;
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.background = selected ? tone.activeBackground : tone.background;
              event.currentTarget.style.boxShadow = `inset 0 0 0 1px ${selected ? tone.color : tone.border}`;
            }}
            onMouseDownCapture={(event) => {
              event.currentTarget.style.transform = 'scale(0.98)';
            }}
            onMouseUp={(event) => {
              event.currentTarget.style.transform = 'scale(1)';
            }}
          >
            {emotion.label}
          </button>
        );
      })}
    </div>,
    document.body,
  );
}
