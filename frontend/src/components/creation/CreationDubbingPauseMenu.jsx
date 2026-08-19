import { useRef, useState } from 'react';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif";

const PAUSE_OPTIONS = ['0.25s', '0.5s', '1.0s', '1.5s'];

export default function CreationDubbingPauseMenu({ onSelect, onCustomInput }) {
  const [customMode, setCustomMode] = useState(false);
  const [customValue, setCustomValue] = useState('');
  const customSubmittedRef = useRef(false);

  const submitCustomValue = () => {
    if (!/^\d+(\.\d+)?$/.test(customValue)) return;
    if (customSubmittedRef.current) return;
    customSubmittedRef.current = true;
    onCustomInput?.(customValue);
  };
  return (
    <div
      role="menu"
      aria-label="停顿时长"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '4px',
        padding: '4px 6px',
        borderRadius: '8px',
        background: '#1D1E1E',
        border: '1px solid #FFFFFF0D',
        boxShadow: '#00000066 2px 2px 6px',
        fontFamily: FONT,
      }}
    >
      {[...PAUSE_OPTIONS, '自定义'].map((option) => (
        <button
          key={option}
          type="button"
          role="menuitem"
          onClick={() => {
            if (option === '自定义') {
              customSubmittedRef.current = false;
              setCustomMode(true);
              return;
            }
            onSelect?.(option);
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '18px',
            minWidth: option === '自定义' ? '56px' : undefined,
            padding: '0 4px',
            border: 'none',
            borderRadius: '6px',
            background: '#2DC3E11A',
            color: option === '自定义' ? '#2DC3E199' : '#2DC3E1',
            fontFamily: FONT,
            fontSize: '14px',
            lineHeight: '18px',
            whiteSpace: 'nowrap',
            cursor: 'pointer',
            boxShadow: 'inset 0 0 0 1px #FFFFFF0D',
            transition: 'background 120ms, color 120ms, box-shadow 120ms',
          }}
          onMouseEnter={(event) => {
            event.currentTarget.style.background = '#2DC3E133';
            event.currentTarget.style.color = '#FFFFFF';
            event.currentTarget.style.boxShadow = 'inset 0 0 0 1px #2DC3E199';
          }}
          onMouseLeave={(event) => {
            event.currentTarget.style.background = '#2DC3E11A';
            event.currentTarget.style.color = option === '自定义' ? '#2DC3E199' : '#2DC3E1';
            event.currentTarget.style.boxShadow = 'inset 0 0 0 1px #FFFFFF0D';
          }}
        >
          {customMode && option === '自定义' ? (
            <input
              autoFocus
              type="text"
              inputMode="decimal"
              value={customValue}
              aria-label="自定义停顿秒数"
              onMouseDown={(event) => event.stopPropagation()}
              onChange={(event) => setCustomValue(event.target.value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1'))}
              onBlur={submitCustomValue}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  submitCustomValue();
                }
              }}
              style={{ width: '42px', padding: 0, border: 0, outline: 'none', background: 'transparent', color: '#FFFFFF', font: 'inherit', textAlign: 'center' }}
            />
          ) : option}
        </button>
      ))}
    </div>
  );
}
