import { useEffect, useRef, useState } from 'react';
import { FONT } from './CreationSelectorPrimitives';
import { DEFAULT_EMOTIONS, getEmotionDisplayLabel } from './CreationSelectorConstants';

// ─── DubbingAdjust — 配音语速 + 情绪调节 ───────────────────────────────────
/* EQ icon from Paper design YFJ-1 */
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

export function DubbingAdjust({ speed, emotion, onSpeedChange, onEmotionChange, emotions, disabled }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const emoList = emotions?.length ? emotions : DEFAULT_EMOTIONS;
  const speedOptions = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0];
  const displaySpeed = speedOptions.reduce((prev, curr) => Math.abs(curr - speed) < Math.abs(prev - speed) ? curr : prev);
  const emoLabel = emotion || '中性';

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      {/* Trigger — matched to YFJ-1 open state */}
      <button type="button" onClick={() => { if (!disabled) setOpen(v => !v); }} disabled={disabled}
        style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '32px', paddingLeft: '12px', paddingRight: '6px', borderRadius: '8px', background: open ? '#1A1A1A' : '#1D1E1E', border: '1px solid ' + (open ? '#2DC3E199' : '#FFFFFF14'), outline: '1px solid #00000080', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.45 : 1, transition: 'background 0.2s, border-color 0.2s' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <DubbingEqIcon />
          <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', color: '#FFFFFF' }}>{displaySpeed}x</span>
          <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', color: '#FFFFFF' }}>{emoLabel}</span>
        </div>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', flexShrink: 0 }}>
          <path d="M12 6.333L8 10.333L4 6.333H12Z" fill="#FFFFFF" stroke="#FFFFFF" strokeWidth="1.333" strokeLinejoin="round" />
        </svg>
      </button>
      {/* Popup — matched to YFJ-1 design: 400px, left-aligned from trigger */}
      {open && (
        <div style={{ position: 'absolute', bottom: 'calc(100% + 2px)', left: '-1px', zIndex: 60, width: '400px', padding: '8px', borderRadius: '8px', background: '#1D1E1E', border: '1px solid #FFFFFF0D', boxShadow: '#00000066 0px 4px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {/* Speed section */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', color: '#FFFFFF66' }}>语速</span>
              <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '18px', color: '#FFFFFF' }}>{displaySpeed}×</span>
            </div>
            <div style={{ borderRadius: '8px', border: '1px solid #FFFFFF14', background: '#1D1E1E', padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ position: 'relative', height: '20px', display: 'flex', alignItems: 'center' }}>
                {/* Empty track */}
                <div style={{ position: 'absolute', left: 0, right: 0, height: '3px', borderRadius: '2px', background: '#FFFFFF1A' }} />
                {/* Filled track */}
                <div style={{ position: 'absolute', left: 0, height: '3px', borderRadius: '2px', background: '#2DC3E1', width: ((speed - 0.5) / 1.5 * 100) + '%' }} />
                {/* Invisible range input */}
                <input type="range" min={0.5} max={2.0} step={0.01} value={speed}
                  className="dubbing-speed-slider"
                  onChange={(e) => onSpeedChange?.(parseFloat(e.target.value))}
                  style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', cursor: 'pointer' }}
                />
                {/* Thumb knob */}
                <div style={{ position: 'absolute', left: ((speed - 0.5) / 1.5 * 100) + '%', top: '50%', transform: 'translate(-50%, -50%)', width: '14px', height: '14px', borderRadius: '50%', background: '#FFFFFF', boxShadow: '#2DC3E1 0px 0px 0px 2px, #00000066 0px 2px 6px', zIndex: 1, pointerEvents: 'none' }} />
              </div>
              <style>{`
                .dubbing-speed-slider { -webkit-appearance: none; appearance: none; background: transparent; cursor: pointer; margin: 0; padding: 0; }
                .dubbing-speed-slider::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 18px; height: 18px; background: transparent; border: none; cursor: pointer; }
                .dubbing-speed-slider::-moz-range-thumb { width: 18px; height: 18px; background: transparent; border: none; cursor: pointer; }
              `}</style>
              {/* Speed labels: 0.5× / 1.0× (Medium) / 2.0× */}
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', color: '#FFFFFF99' }}>0.5×</span>
                <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', color: '#FFFFFF99' }}>1.0×</span>
                <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', color: '#FFFFFF99' }}>1.5×</span>
                <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', color: '#FFFFFF99' }}>2.0×</span>
              </div>
            </div>
          </div>
          {/* Emotion section */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', color: '#FFFFFF66' }}>情绪</span>
            {[0, 1].map(row => (
              <div key={row} style={{ display: 'flex', gap: '4px' }}>
                {emoList.slice(row * 4, row * 4 + 4).map(em => {
                  const isSelected = em === emotion;
                  return (
                    <button key={em} type="button" onClick={() => onEmotionChange?.(isSelected ? '' : em)}
                      style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px 12px', borderRadius: '4px', border: 'none', background: isSelected ? '#FFFFFF14' : '#FFFFFF0D', boxShadow: isSelected ? '#FFFFFF33 0px 0px 0px 1px inset' : 'none', color: isSelected ? '#FFFFFF' : '#FFFFFF66', fontFamily: FONT, fontSize: '12px', lineHeight: '16px', cursor: 'pointer', transition: 'background 0.15s, box-shadow 0.15s, color 0.15s' }}>
                      {getEmotionDisplayLabel(em)}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
