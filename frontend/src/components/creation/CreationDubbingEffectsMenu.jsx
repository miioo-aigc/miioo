import { useState } from 'react';
import { FONT } from './CreationSelectorPrimitives';
import { DEFAULT_DUBBING_EFFECTS } from './CreationDubbingEffectsDefaults';

const TONE_CONTROLS = [
  { key: 'brightness', negativeLabel: '低沉', positiveLabel: '明亮' },
  { key: 'softness', negativeLabel: '力量感', positiveLabel: '柔和' },
  { key: 'clarity', negativeLabel: '磁性', positiveLabel: '清脆' },
];

const EFFECT_OPTIONS = [
  { key: 'echo', label: '空旷回声' },
  { key: 'hall', label: '礼堂广播' },
  { key: 'telephone', label: '电话失真' },
  { key: 'electronic', label: '电音' },
];

function getDirectionalMagnitude(value, isNegative) {
  const numericValue = Number(value) || 0;
  if (isNegative) return numericValue < 0 ? Math.abs(numericValue) : 0;
  return numericValue > 0 ? numericValue : 0;
}

function parseMagnitude(value) {
  const digits = String(value).replace(/[^0-9]/g, '');
  if (!digits) return null;
  return Math.min(100, Number.parseInt(digits, 10));
}

function ValueInput({ side, value, onChange }) {
  const isNegative = side === 'negative';
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState('0');
  const displayedMagnitude = focused ? draft : String(getDirectionalMagnitude(value, isNegative));

  const commit = () => {
    const magnitude = parseMagnitude(draft) ?? 0;
    setDraft(String(magnitude));
    onChange(isNegative ? -magnitude : magnitude);
  };

  const handleChange = (event) => {
    const nextDraft = event.target.value.replace(/[^0-9]/g, '');
    setDraft(nextDraft);
    const magnitude = parseMagnitude(nextDraft);
    if (magnitude != null) onChange(isNegative ? -magnitude : magnitude);
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      value={isNegative ? `-${displayedMagnitude}` : `+${displayedMagnitude}`}
      aria-label={isNegative ? '负向数值' : '正向数值'}
      onChange={handleChange}
      onFocus={(event) => {
        setDraft(String(getDirectionalMagnitude(value, isNegative)));
        setFocused(true);
        window.requestAnimationFrame(() => event.target.select());
      }}
      onBlur={() => {
        commit();
        setFocused(false);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          commit();
          event.currentTarget.blur();
        }
      }}
      style={{ display: 'block', width: '40px', minHeight: '22px', flexShrink: 0, boxSizing: 'border-box', padding: '2px 4px', border: '1px solid transparent', borderRadius: '4px', background: '#FFFFFF1A', outline: 'none', textAlign: 'center', fontFamily: FONT, fontSize: '12px', lineHeight: '18px', color: '#FFFFFF', caretColor: '#2DC3E1' }}
      className="dubbing-effects-value-input"
    />
  );
}

function ToneSlider({ config, value, onChange }) {
  const thumbPosition = (value + 100) / 2;
  const fillStart = Math.min(50, thumbPosition);
  const fillWidth = Math.abs(thumbPosition - 50);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '16px', flexShrink: 0 }}>
        <span style={{ width: '40px', textAlign: 'center', fontFamily: FONT, fontSize: '12px', lineHeight: '16px', color: '#FFFFFFCC' }}>
          {config.negativeLabel}
        </span>
        <span style={{ width: '40px', textAlign: 'center', fontFamily: FONT, fontSize: '12px', lineHeight: '16px', color: '#FFFFFFCC' }}>
          {config.positiveLabel}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', paddingTop: '4px', paddingBottom: '8px' }}>
        <ValueInput side="negative" value={value} onChange={onChange} />

        <div className="dubbing-effects-slider-track" style={{ position: 'relative', display: 'flex', alignItems: 'center', height: '20px', flex: 1 }}>
          <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', height: '3px', transform: 'translateY(-50%)', borderRadius: '2px', background: '#FFFFFF33' }} />
          <div style={{ position: 'absolute', left: `${fillStart}%`, top: '50%', width: `${fillWidth}%`, height: '3px', transform: 'translateY(-50%)', borderRadius: '2px', background: '#2DC3E1' }} />
          <div className="dubbing-effects-slider-thumb" style={{ position: 'absolute', left: `${thumbPosition}%`, top: '50%', width: '14px', height: '14px', transform: 'translate(-50%, -50%)', borderRadius: '50%', background: '#FFFFFF', boxShadow: 'var(--color-brand-main) 0px 0px 0px 2px, #00000066 0px 2px 6px', pointerEvents: 'none' }} />
          <input
            className="dubbing-effects-range"
            type="range"
            min="-100"
            max="100"
            step="1"
            value={value}
            aria-label={`${config.negativeLabel}到${config.positiveLabel}`}
            aria-valuetext={value === 0 ? '0' : value > 0 ? `${config.positiveLabel} ${value}` : `${config.negativeLabel} ${Math.abs(value)}`}
            onChange={(event) => onChange(Number(event.target.value))}
          />
        </div>

        <ValueInput side="positive" value={value} onChange={onChange} />
      </div>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg width="8" height="8" viewBox="0 0 8 8" fill="none" aria-hidden="true">
      <path d="M1.25 4.05 3.1 5.9 6.75 2.25" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function CreationDubbingEffectsMenu({ toneValues = DEFAULT_DUBBING_EFFECTS.toneValues, selectedEffects = DEFAULT_DUBBING_EFFECTS.selectedEffects, onToneChange, onEffectToggle }) {

  const toggleEffect = (effectKey) => {
    const nextEffects = selectedEffects.includes(effectKey) ? [] : [effectKey];
    onEffectToggle?.(nextEffects);
  };

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
        {TONE_CONTROLS.map((config) => (
          <ToneSlider
            key={config.key}
            config={config}
            value={toneValues[config.key]}
            onChange={(value) => onToneChange?.(config.key, value)}
          />
        ))}
      </div>

      <div role="group" aria-label="声音效果" style={{ display: 'flex', alignItems: 'stretch', gap: '8px', width: '100%' }}>
        {EFFECT_OPTIONS.map((option) => {
          const selected = selectedEffects.includes(option.key);
          return (
            <button
              key={option.key}
              type="button"
              className="dubbing-effect-option"
              aria-pressed={selected}
              onClick={() => toggleEffect(option.key)}
              style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '1 1 0%', minWidth: 0, minHeight: '32px', padding: '8px 12px', border: 0, borderRadius: '4px', background: '#FFFFFF14', boxShadow: selected ? '#2DC3E1 0px 0px 0px 1px inset' : '#FFFFFF33 0px 0px 0px 1px inset', color: '#FFFFFF', fontFamily: FONT, fontSize: '12px', lineHeight: '16px', cursor: 'pointer', transition: 'background 120ms, box-shadow 120ms' }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{option.label}</span>
              {selected && (
                <span style={{ position: 'absolute', top: 0, right: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '12px', height: '12px', borderTopRightRadius: '4px', borderBottomLeftRadius: '4px', background: '#2DC3E1', color: '#FFFFFF' }}>
                  <CheckIcon />
                </span>
              )}
            </button>
          );
        })}
      </div>

      <style>{`
        .dubbing-effects-range {
          position: absolute;
          inset: 0 -7px;
          width: calc(100% + 14px);
          height: 20px;
          margin: 0;
          padding: 0;
          appearance: none;
          -webkit-appearance: none;
          background: transparent;
          cursor: pointer;
        }
        .dubbing-effects-range::-webkit-slider-thumb {
          width: 18px;
          height: 18px;
          appearance: none;
          -webkit-appearance: none;
          border: 0;
          background: transparent;
          cursor: grab;
        }
        .dubbing-effects-range::-moz-range-thumb {
          width: 18px;
          height: 18px;
          border: 0;
          background: transparent;
          cursor: grab;
        }
        .dubbing-effects-range:active::-webkit-slider-thumb { cursor: grabbing; }
        .dubbing-effects-range:active::-moz-range-thumb { cursor: grabbing; }
        .dubbing-effects-slider-track:hover .dubbing-effects-slider-thumb,
        .dubbing-effects-range:focus-visible + .dubbing-effects-slider-thumb {
          box-shadow: var(--color-brand-main) 0px 0px 0px 3px, #00000066 0px 2px 8px !important;
        }
        .dubbing-effect-option:hover { background: #FFFFFF1F !important; }
        .dubbing-effect-option:active { background: #FFFFFF29 !important; }
        .dubbing-effect-option:focus-visible { outline: 2px solid rgba(45, 195, 225, 0.8); outline-offset: 2px; }
        .dubbing-effects-value-input:hover { border-color: rgba(255,255,255,0.2) !important; }
        .dubbing-effects-value-input:focus { border-color: rgba(45,195,225,0.8) !important; box-shadow: 0 0 0 1px rgba(45,195,225,0.25); }
      `}</style>
    </div>
  );
}
