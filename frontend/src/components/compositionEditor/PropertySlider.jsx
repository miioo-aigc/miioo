import { useId, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import Slider from '../ui/Slider';

function timeText(value) {
  const tenths = Math.round(value * 10);
  const seconds = (tenths % 600) / 10;
  return `${String(Math.floor(tenths / 600)).padStart(2, '0')}:${seconds.toFixed(tenths % 10 ? 1 : 0).padStart(tenths % 10 ? 4 : 2, '0')}`;
}

export default function PropertySlider({ label, value, min, max, step = 0.1, sliderStep = step,
  unit = '秒', disabled = false, hint, onCommit, onChange, sliderProps = {}, inputOnly = false, integer = false, unitInside = true, hideLabel = false, leftAligned = false, inlineSlider = false, compact = false, precision, middleValue }) {
  const id = useId();
  const [draft, setDraft] = useState(null);
  const middleTick = middleValue ?? (min + max) / 2;
  const showMiddleTick = middleTick > min && middleTick < max;
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
  const stepButton = (direction) => {
    const Icon = direction === 1 ? Plus : Minus;
    const name = `${direction === 1 ? '增加' : '减少'}${label}`;
    return <button type="button" aria-label={name} title={name}
      disabled={disabled || (direction === 1 ? value >= max : value <= min)}
      onMouseDown={(event) => event.preventDefault()} onClick={() => move(direction)}
      className={`flex h-full w-[24px] shrink-0 cursor-pointer items-center justify-center border-stroke-normal text-text-secondary hover:bg-white-10 hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-text-secondary ${direction === 1 ? 'border-l' : 'border-r'}`}>
      <Icon size={14} />
    </button>;
  };
  return (
    <div className="flex min-w-0 shrink-0 flex-col gap-[8px]">
      <div className={`flex items-center ${leftAligned ? 'gap-[12px]' : 'justify-between gap-[8px]'}`}>
        <label htmlFor={id} className={hideLabel ? 'sr-only' : `${leftAligned ? 'w-[64px] shrink-0 ' : ''}text-font-size-14 text-text-secondary`}>{label}</label>
        {inlineSlider && <Slider {...sliderProps} aria-label={`${label}滑轨`} className="min-w-0 flex-1" min={min} max={max} step={sliderStep} value={value} disabled={disabled} onChange={(event) => onChange(Number(event.target.value))} />}
        <div className="flex shrink-0 items-center gap-[8px]">
          <div className={`flex h-[28px] ${compact ? 'w-[112px]' : 'w-[128px]'} items-center overflow-hidden rounded-small border border-stroke-normal bg-neutral-100 focus-within:outline focus-within:outline-brand-main`}>
            {stepButton(-1)}
            <div className="flex min-w-0 flex-1 items-center justify-center px-[4px]">
            <input id={id} aria-label={`${label}数值`} inputMode="decimal" disabled={disabled} value={draft ?? format(value)}
              onChange={(event) => setDraft(event.target.value)}
              onBlur={() => { if (draft !== null) submit(parse(draft)); }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.currentTarget.blur();
                if (event.key === 'Escape') setDraft(null);
                if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
                  event.preventDefault(); move(event.key === 'ArrowUp' ? 1 : -1);
                }
              }}
              className="w-full min-w-0 bg-transparent text-center text-font-size-14 text-text-primary tabular-nums outline-none disabled:opacity-40" />
            {unitInside && unit && <span className={`shrink-0 text-font-size-12 text-text-secondary ${disabled ? 'opacity-40' : ''}`}>{unit}</span>}
            </div>
            {stepButton(1)}
          </div>
          {unit && !unitInside && <span className="text-font-size-14 text-text-secondary">{unit}</span>}
        </div>
      </div>
      {!inputOnly && <div className="flex flex-col gap-[16px] rounded-medium border border-stroke-normal bg-neutral-100 px-[12px] pb-[10px] pt-[18px]">
        <Slider {...sliderProps} aria-label={label} min={min} max={max} step={sliderStep}
          value={Math.min(max, Math.max(min, value))} disabled={disabled}
          onChange={(event) => onChange(Number(event.target.value))} />
        <div className="relative flex justify-between text-font-size-12 text-text-secondary tabular-nums" aria-hidden="true">
          <span>{format(min)}{unit !== '秒' ? unit : ''}</span>
          {showMiddleTick && <span className="absolute -translate-x-1/2" style={{ left: ((middleTick - min) / (max - min) * 100) + '%' }}>
            {format(middleTick)}{unit !== '秒' ? unit : ''}
          </span>}
          <span>{format(max)}{unit !== '秒' ? unit : ''}</span>
        </div>
      </div>}
      {hint && <span className="text-font-size-12 text-text-hint">{hint}</span>}
    </div>
  );
}
