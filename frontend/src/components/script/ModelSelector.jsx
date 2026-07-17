/**
 * @file ModelSelector.jsx
 * @structure-index
 *
 * ─── 组件职责 ───────────────────────────────────────────────────────
 *   聊天模型下拉选择和选中态展示
 *
 * ─── 更新记录 ───────────────────────────────────────────────────────
 *   2026-07-15  从 ScriptPage 抽离，保持模型选择行为不变
 *   2026-07-15  使用 label 作为受控显示值，移除同步 effect
 */
import { useEffect, useRef, useState } from 'react';
import { Button } from '../ui';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif";

function ModelSelector({ label, options, width, disabled = false, onSelect }) {
  const [open, setOpen] = useState(false);
  const selected = label;
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

  return (
    <div ref={ref} style={{ position: 'relative', width }}>
      <Button
        variant="secondary"
        aria-label={`选择模型，当前为 ${selected}`}
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
        <span className="truncate" title={selected}>{selected}</span>
        <svg
          aria-hidden="true"
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ flexShrink: 0, transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          <path d="M12 6.333L8 10.333L4 6.333H12Z" fill="#FFFFFF" stroke="#FFFFFF" strokeWidth="1.333" strokeLinejoin="round" />
        </svg>
      </Button>

      {open && !disabled && (
        <div
          className="rounded-medium bg-select-bg border border-select-border p-[4px]"
          style={{
            position: 'absolute',
            zIndex: 50,
            left: 0,
            marginBottom: '4px',
            minWidth: '100%',
            maxWidth: '100%',
            width: '100%',
            bottom: '100%',
            outline: '1px solid #00000080',
            boxShadow: '0px -4px 16px var(--color-select-shadow)',
          }}
        >
          {options.map((option) => (
            <Button
              key={option}
              variant="secondary"
              type="button"
              onClick={() => {
                setOpen(false);
                onSelect?.(option);
              }}
              className={`!h-auto !w-full !justify-start !rounded-md !border-0 !px-[12px] !py-[8px] !shadow-none !text-left ${
                option === selected
                  ? '!bg-select-item-bg-active !text-select-item-text-active'
                  : '!bg-select-item-bg-normal !text-select-item-text-normal hover:!bg-select-item-bg-hover hover:!text-select-item-text-hover'
              }`}
              contentClassName="!w-auto !justify-start !text-left !text-font-size-14"
              style={{ fontFamily: FONT }}
            >
              <span className="truncate" title={option}>{option}</span>
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

export default ModelSelector;
