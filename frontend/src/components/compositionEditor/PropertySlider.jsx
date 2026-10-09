import { useId, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import Slider from '../ui/Slider';

function timeText(value) {
  const tenths = Math.round(value * 10);
  const seconds = (tenths % 600) / 10;
  return `${String(Math.floor(tenths / 600)).padStart(2, '0')}:${seconds.toFixed(tenths % 10 ? 1 : 0).padStart(tenths % 10 ? 4 : 2, '0')}`;
}

export default function PropertySlider({ label, value, min, max, step = 0.1, sliderStep = step,
  unit = '秒', disabled = false, hint, onCommit, onChange, sliderProps = {}, inputOnly = false, integer = false, unitInside = true, hideLabel = false, leftAligned = false, inlineSlider = false, compact = false, precision }) {
  const id = useId();
  const [draft, setDraft] = useState(null);
  const format = precision != null ? (number) => String(Number(number.toFixed(precision))) : integer ? (number) => String(Math.round(number)) : unit === '秒' ? timeText : String;
  const parse = (text) => {
    if (!text.trim()) return NaN;
    if (unit !== '秒' || !text.includes(':')) return Number(text);
    if (!/^\d+:\d{1,2}(\.\d+)?$/.test(text)) return NaN;
    const [minutes, seconds] = text.split(':').map(Number);
    return seconds < 60 ? minutes * 60 + seconds : NaN;
  };
  const submit = (next) => {
    if (Number.isFinite(next)) {
      const clamped = integer
        ? Math.min(Math.floor(max), Math.max(Math.ceil(min), Math.round(next)))
        : Math.min(max, Math.max(min, Number(next.toFixed(precision ?? 3))));
      if (clamped !== value) onCommit(clamped);
    }
    setDraft(null);
  };
  const move = (direction) => {
    const parsed = draft === null ? value : parse(draft);
    const base = Number.isFinite(parsed) ? parsed : value;
    submit((integer ? Math.round(base) : base) + direction * step);
  };
  return (
    <div className="flex min-w-0 shrink-0 flex-col gap-[8px]">
      <div className={`flex items-center ${leftAligned ? 'gap-[12px]' : 'justify-between gap-[8px]'}`}>
        <label htmlFor={id} className={hideLabel ? 'sr-only' : `${leftAligned ? 'w-[64px] shrink-0 ' : ''}text-font-size-14 text-text-secondary`}>{label}</label>
        {inlineSlider && <Slider {...sliderProps} aria-label={`${label}滑轨`} className="min-w-0 flex-1" min={min} max={max} step={sliderStep} value={value} disabled={disabled} onChange={(event) => onChange(Number(event.target.value))} />}
        <div className="flex shrink-0 items-center gap-[8px]">
          <div className={`flex h-[28px] ${compact ? 'w-[76px]' : 'w-[88px]'} items-center overflow-hidden rounded-small bg-white-10 focus-within:outline focus-within:outline-brand-main`}>
            <input id={id} aria-label={`${label}数值`} disabled={disabled} value={draft ?? format(value)}
              onChange={(event) => setDraft(event.target.value)}
              onBlur={() => { if (draft !== null) submit(parse(draft)); }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.currentTarget.blur();
                if (event.key === 'Escape') setDraft(null);
                if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
                  event.preventDefault(); move(event.key === 'ArrowUp' ? 1 : -1);
                }
              }}
              className="w-full min-w-0 bg-transparent pl-[8px] text-font-size-14 text-text-primary outline-none disabled:opacity-40" />
            {unitInside && unit && <span className={`shrink-0 px-[4px] text-font-size-12 text-text-secondary ${disabled ? 'opacity-40' : ''}`}>{unit}</span>}
            <div className="flex h-full w-[20px] shrink-0 flex-col">
              {[1, -1].map((direction) => {
                const Icon = direction === 1 ? ChevronUp : ChevronDown;
                const name = `${direction === 1 ? '增加' : '减少'}${label}`;
                return <button key={direction} type="button" aria-label={name} title={name}
                  disabled={disabled || (direction === 1 ? value >= max : value <= min)}
                  onMouseDown={(event) => event.preventDefault()} onClick={() => move(direction)}
                  className="flex min-h-0 flex-1 items-center justify-center text-text-secondary hover:bg-white-10 hover:text-text-primary disabled:opacity-40 disabled:cursor-not-allowed">
                  <Icon size={12} />
                </button>;
              })}
            </div>
          </div>
          {unit && !unitInside && <span className="text-font-size-14 text-text-secondary">{unit}</span>}
        </div>
      </div>
      {!inputOnly && <div className="flex flex-col gap-[16px] rounded-medium border border-stroke-normal bg-neutral-100 px-[12px] pb-[10px] pt-[18px]">
        <Slider {...sliderProps} aria-label={label} min={min} max={max} step={sliderStep}
          value={Math.min(max, Math.max(min, value))} disabled={disabled}
          onChange={(event) => onChange(Number(event.target.value))} />
        <div className="flex justify-between text-font-size-12 text-text-secondary tabular-nums" aria-hidden="true">
          {[min, (min + max) / 2, max].map((tick, index) => <span key={index}>{format(tick)}{unit !== '秒' ? unit : ''}</span>)}
        </div>
      </div>}
      {hint && <span className="text-font-size-12 text-text-hint">{hint}</span>}
    </div>
  );
}
