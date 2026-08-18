import { useEffect, useRef, useState } from 'react';
import Toggle from '../Toggle';
import { FONT } from './CreationSelectorPrimitives';

const SLIDER_CONFIGS = [
  { key: 'speed', label: '语速', min: 0.5, max: 2, step: 0.01, format: (value) => `${value.toFixed(2)}×`, marks: [0.5, 1, 1.5, 2] },
  { key: 'pitch', label: '声调', min: -12, max: 12, step: 1, format: (value) => String(Math.round(value)), marks: [-12, -4, 4, 12] },
  { key: 'volume', label: '音量', min: 0.01, max: 10, step: 0.01, format: (value) => value.toFixed(2), marks: [0.01, 3.34, 6.67, 10] },
];

function DubbingEqIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <path d="M3.666 5.333V14" fill="none" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 9.667V14" fill="none" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 6.333V2" fill="none" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12.334 2V10.667" fill="none" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3.667 5.333C4.587 5.333 5.333 4.587 5.333 3.667C5.333 2.746 4.587 2 3.667 2C2.746 2 2 2.746 2 3.667C2 4.587 2.746 5.333 3.667 5.333Z" fill="none" stroke="#FFFFFF" strokeLinejoin="round" />
      <path d="M8.001 9.667C8.921 9.667 9.667 8.921 9.667 8C9.667 7.08 8.921 6.333 8.001 6.333C7.08 6.333 6.334 7.08 6.334 8C6.334 8.921 7.08 9.667 8.001 9.667Z" fill="none" stroke="#FFFFFF" strokeLinejoin="round" />
      <path d="M12.333 14C13.253 14 13.999 13.254 13.999 12.333C13.999 11.413 13.253 10.667 12.333 10.667C11.412 10.667 10.666 11.413 10.666 12.333C10.666 13.254 11.412 14 12.333 14Z" fill="none" stroke="#FFFFFF" strokeLinejoin="round" />
    </svg>
  );
}

function DubbingRangeControl({ config, value, onChange }) {
  const numericValue = Number(value);
  const safeValue = Number.isFinite(numericValue) ? numericValue : config.min;
  const progress = Math.min(100, Math.max(0, ((safeValue - config.min) / (config.max - config.min)) * 100));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', color: '#FFFFFF66' }}>{config.label}</span>
        <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '18px', color: '#FFFFFF' }}>{config.format(safeValue)}</span>
      </div>
      <div style={{ borderRadius: '8px', border: '1px solid #FFFFFF14', background: '#1D1E1E', padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ position: 'relative', height: '20px', display: 'flex', alignItems: 'center' }}>
          <div style={{ position: 'absolute', left: 0, right: 0, height: '3px', borderRadius: '2px', background: '#FFFFFF1A' }} />
          <div style={{ position: 'absolute', left: 0, height: '3px', borderRadius: '2px', background: '#2DC3E1', width: `${progress}%` }} />
          <input
            type="range"
            min={config.min}
            max={config.max}
            step={config.step}
            value={safeValue}
            className="dubbing-range-slider"
            aria-label={config.label}
            onChange={(event) => onChange?.(Number(event.target.value))}
            style={{ position: 'absolute', left: '-9px', top: 0, width: 'calc(100% + 18px)', height: '100%', cursor: 'pointer' }}
          />
          <div style={{ position: 'absolute', left: `${progress}%`, top: '50%', transform: 'translate(-50%, -50%)', width: '14px', height: '14px', borderRadius: '50%', background: '#FFFFFF', boxShadow: '#2DC3E1 0px 0px 0px 2px, #00000066 0px 2px 6px', zIndex: 1, pointerEvents: 'none' }} />
        </div>
        <div style={{ position: 'relative', height: '16px' }}>
          {config.marks.map((mark, index) => {
            const markPosition = ((mark - config.min) / (config.max - config.min)) * 100;
            const isFirstMark = index === 0;
            const isLastMark = index === config.marks.length - 1;
            const transform = isFirstMark ? 'translateX(0)' : isLastMark ? 'translateX(-100%)' : 'translateX(-50%)';

            return (
              <span key={mark} style={{ position: 'absolute', left: `${markPosition}%`, transform, fontFamily: FONT, fontSize: '12px', lineHeight: '16px', color: '#FFFFFF99', whiteSpace: 'nowrap' }}>
              {config.format(mark)}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function DubbingAdjust({ speed, pitch, volume, onSpeedChange, onPitchChange, onVolumeChange, advancedEnabled = false, onAdvancedChange, disabled }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const values = { speed, pitch, volume };
  const changeHandlers = { speed: onSpeedChange, pitch: onPitchChange, volume: onVolumeChange };
  const displayValues = SLIDER_CONFIGS.map((config) => {
    const numericValue = Number(values[config.key]);
    return config.format(Number.isFinite(numericValue) ? numericValue : config.min);
  });

  useEffect(() => {
    if (!open) return undefined;
    const handleOutsideMouseDown = (event) => {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleOutsideMouseDown);
    return () => document.removeEventListener('mousedown', handleOutsideMouseDown);
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => { if (!disabled) setOpen((current) => !current); }}
        disabled={disabled}
        style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '32px', paddingLeft: '12px', paddingRight: '6px', borderRadius: '8px', background: open ? '#1A1A1A' : '#1D1E1E', border: `1px solid ${open ? '#2DC3E199' : '#FFFFFF14'}`, outline: '1px solid #00000080', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.45 : 1, transition: 'background 0.2s, border-color 0.2s' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap' }}>
          <DubbingEqIcon />
          <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', color: '#FFFFFF' }}>语速 {displayValues[0]}</span>
          <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', color: '#FFFFFF' }}>声调 {displayValues[1]}</span>
          <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', color: '#FFFFFF' }}>音量 {displayValues[2]}</span>
        </div>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', flexShrink: 0 }}>
          <path d="M12 6.333L8 10.333L4 6.333H12Z" fill="#FFFFFF" stroke="#FFFFFF" strokeWidth="1.333" strokeLinejoin="round" />
        </svg>
      </button>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', height: '32px', paddingLeft: '12px', paddingRight: '6px', borderRadius: '8px', background: '#1D1E1E', border: '1px solid #FFFFFF14', outline: '1px solid #00000080', flexShrink: 0, opacity: disabled ? 0.45 : 1, pointerEvents: disabled ? 'none' : 'auto' }}>
        <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', color: '#FFFFFFCC', whiteSpace: 'nowrap' }}>高级模式</span>
        <Toggle value={advancedEnabled} onChange={onAdvancedChange} />
      </div>

      {open && (
        <div style={{ position: 'absolute', bottom: 'calc(100% + 4px)', left: '-1px', zIndex: 60, width: '400px', padding: '8px', borderRadius: '8px', background: '#1D1E1E', border: '1px solid #FFFFFF0D', boxShadow: '#00000066 0px 4px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {SLIDER_CONFIGS.map((config) => (
            <DubbingRangeControl key={config.key} config={config} value={values[config.key]} onChange={changeHandlers[config.key]} />
          ))}
        </div>
      )}

      <style>{`
        .dubbing-range-slider { -webkit-appearance: none; appearance: none; background: transparent; cursor: pointer; margin: 0; padding: 0; }
        .dubbing-range-slider::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 18px; height: 18px; background: transparent; border: none; cursor: pointer; }
        .dubbing-range-slider::-moz-range-thumb { width: 18px; height: 18px; background: transparent; border: none; cursor: pointer; }
      `}</style>
    </div>
  );
}
