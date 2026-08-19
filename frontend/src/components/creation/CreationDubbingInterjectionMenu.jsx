const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif";

const INTERJECTIONS = ['笑声', '轻笑', '咳嗽', '清嗓子', '呻吟', '正常换气', '喘气', '吸气', '呼气', '倒吸气', '吸鼻子', '叹气', '哼', '打嗝', '咂嘴', '哼唱', '嘶嘶声', '呃', '唌'];

export default function CreationDubbingInterjectionMenu({ onSelect }) {
  return (
    <div
      role="menu"
      aria-label="语气词"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        width: '100px',
        height: '180px',
        boxSizing: 'border-box',
        padding: '4px',
        overflowY: 'auto',
        borderRadius: '8px',
        background: '#1D1E1E',
        border: '1px solid #FFFFFF0D',
        boxShadow: '#00000066 0px 4px 16px',
        fontFamily: FONT,
      }}
    >
      {INTERJECTIONS.map((option) => (
        <button
          key={option}
          type="button"
          role="menuitem"
          onClick={() => onSelect?.(option)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            minHeight: '34px',
            padding: '8px 12px',
            border: 'none',
            borderRadius: '6px',
            background: 'transparent',
            color: '#FFFFFF99',
            fontFamily: FONT,
            fontSize: '14px',
            lineHeight: '18px',
            textAlign: 'left',
            whiteSpace: 'nowrap',
            cursor: 'pointer',
            transition: 'background 120ms, color 120ms',
          }}
          onMouseEnter={(event) => {
            event.currentTarget.style.background = '#FFFFFF0D';
            event.currentTarget.style.color = '#FFFFFF';
          }}
          onMouseLeave={(event) => {
            event.currentTarget.style.background = 'transparent';
            event.currentTarget.style.color = '#FFFFFF99';
          }}
        >
          {option}
        </button>
      ))}
    </div>
  );
}
