/**
 * @file EpisodeCountSelector.jsx
 * @structure-index
 *
 * ─── 组件职责 ───────────────────────────────────────────────────────
 *   剧本集数自动适应/固定数量选择
 *
 * ─── 更新记录 ───────────────────────────────────────────────────────
 *   2026-07-15  从 ScriptPage 抽离，保持集数选择行为不变
 */
import { useEffect, useRef, useState } from 'react';
import { Button } from '../ui';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif";

function EpisodeCountSelector({ value, onChange, disabled = false }) {
  const [open, setOpen] = useState(false);
  const [inputVal, setInputVal] = useState(typeof value === 'number' ? value : 1);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const isActive = open || hovered;
  const label = value == null ? '集数：自动适应' : `集数：${value} 集`;

  const handleAutoSelect = () => { onChange(null); setOpen(false); };

  const adjustCount = (delta) => {
    const base = typeof inputVal === 'number' ? inputVal : 1;
    const next = Math.max(1, base + delta);
    setInputVal(next);
    onChange(next);
  };

  const handleInputChange = (e) => {
    const raw = e.target.value;
    if (raw === '') { setInputVal(''); return; }
    const n = parseInt(raw, 10);
    if (!isNaN(n) && n >= 1) { setInputVal(n); onChange(n); }
  };

  const handleInputBlur = () => {
    const n = parseInt(inputVal, 10);
    if (isNaN(n) || n < 1) { setInputVal(1); onChange(1); }
  };

  return (
    <div ref={ref} style={{ position: 'relative', width: '140px' }}>
      <Button
        variant="secondary"
        aria-label={`选择集数，当前为 ${label}`}
        disabled={disabled}
        onClick={() => !disabled && setOpen((value) => !value)}
        onMouseEnter={() => !disabled && setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        contentClassName="!w-full !justify-between !text-left !text-font-size-12 !text-text-secondary"
        className="!h-[32px] !w-full !justify-between !rounded-[8px] !px-[12px] !pr-[6px] !shadow-none"
        style={{
          cursor: disabled ? 'not-allowed' : 'pointer',
          background: open ? '#252525' : isActive ? '#222222' : '#1D1E1E',
          borderColor: open ? '#FFFFFF33' : '#FFFFFF14',
          outline: focused || open ? '1px solid #2DC3E180' : '1px solid #00000080',
          transition: 'background 0.2s, border-color 0.2s, outline 0.2s, opacity 0.2s',
          opacity: disabled ? 0.45 : 1,
        }}
      >
        <span className="truncate" title={label}>{label}</span>
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0, transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}>
          <path d="M12 6.333L8 10.333L4 6.333H12Z" fill="#FFFFFF" stroke="#FFFFFF" strokeWidth="1.333" strokeLinejoin="round" />
        </svg>
      </Button>

      {open && !disabled && (
        <div
          className="rounded-medium bg-select-bg border border-select-border p-[4px]"
          style={{
            position: 'absolute', zIndex: 50, left: 0, marginBottom: '4px',
            width: '100%', maxWidth: '100%', bottom: '100%',
            outline: '1px solid #00000080',
            boxShadow: '0px -4px 16px var(--color-select-shadow)',
          }}
        >
          <Button
            variant="secondary"
            type="button"
            onClick={handleAutoSelect}
            className={`!h-auto !w-full !justify-start !rounded-md !border-0 !px-[12px] !py-[8px] !shadow-none !text-left ${
              value == null
                ? '!bg-select-item-bg-active !text-select-item-text-active'
                : '!bg-select-item-bg-normal !text-select-item-text-normal hover:!bg-select-item-bg-hover hover:!text-select-item-text-hover'
            }`}
            contentClassName="!w-auto !justify-start !text-left !text-font-size-14"
            style={{ fontFamily: FONT }}
          >
            集数：自动适应
          </Button>

          <div
            className={`flex items-center px-[12px] py-[8px] rounded-md gap-[4px] ${
              value != null
                ? 'bg-select-item-bg-active'
                : 'bg-select-item-bg-normal hover:bg-select-item-bg-hover'
            }`}
          >
            <Button
              variant="secondary"
              size="small"
              type="button"
              aria-label="减少集数"
              onClick={(e) => { e.stopPropagation(); adjustCount(-1); }}
              className="!h-[20px] !w-[20px] !rounded-[4px] !border-0 !p-0 !shadow-none !bg-white-8 !text-select-item-text-normal hover:!bg-white-20"
              contentClassName="!text-[14px]"
            >
              −
            </Button>
            <input
              type="number"
              min="1"
              value={inputVal}
              onChange={handleInputChange}
              onBlur={handleInputBlur}
              onClick={(e) => { e.stopPropagation(); if (value == null) { setInputVal(1); onChange(1); } }}
              className="[&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none text-select-item-text-normal bg-white-5 border border-stroke-normal rounded-[4px] text-center outline-none text-font-size-14 flex-1 min-w-0"
              style={{ height: '20px', fontFamily: FONT, MozAppearance: 'textfield' }}
            />
            <Button
              variant="secondary"
              size="small"
              type="button"
              aria-label="增加集数"
              onClick={(e) => { e.stopPropagation(); adjustCount(1); }}
              className="!h-[20px] !w-[20px] !rounded-[4px] !border-0 !p-0 !shadow-none !bg-white-8 !text-select-item-text-normal hover:!bg-white-20"
              contentClassName="!text-[14px]"
            >
              +
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default EpisodeCountSelector;
