import { useState } from 'react';
import { Dropdown, DropdownItem, FONT } from './CreationSelectorPrimitives';
import { ModelIcon } from '../ui';

// ─── Model selector ───────────────────────────────────────────────────────────
export function ModelSelector({ value, onChange, options = [], disabled, onBeforeOpen }) {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const isActive = open || hovered;
  const currentLabel = options.find((o) => o.value === value)?.label || value;

  const handleClick = () => {
    if (disabled) return;
    // 在打开前调用回调，如果返回 false 则不打开
    if (onBeforeOpen && onBeforeOpen() === false) return;
    setOpen((v) => !v);
  };

  return (
    <Dropdown
      open={open}
      onClose={() => setOpen(false)}
      trigger={
        <button
          type="button"
          disabled={disabled}
          onClick={handleClick}
          onMouseEnter={() => !disabled && setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            height: '32px',
            width: '180px',
            paddingLeft: '12px',
            paddingRight: '6px',
            borderRadius: '8px',
            justifyContent: 'space-between',
            flexShrink: 0,
            border: '1px solid',
            cursor: disabled ? 'not-allowed' : 'pointer',
            background: open ? '#252525' : isActive ? '#222222' : '#1D1E1E',
            borderColor: open ? '#FFFFFF33' : '#FFFFFF14',
            outline: focused || open ? '1px solid #2DC3E180' : '1px solid #00000080',
            transition: 'background 0.2s, border-color 0.2s, outline 0.2s',
            opacity: disabled ? 0.45 : 1,
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16, flexShrink: 0, opacity: 0.8 }}>
            <ModelIcon name={currentLabel} />
          </span>
          <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', color: '#FFFFFFCC', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, textAlign: 'left' }}>
              {currentLabel}
          </span>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"
            style={{ flexShrink: 0, transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}>
            <path d="M12 6.333L8 10.333L4 6.333H12Z" fill="#FFFFFF" stroke="#FFFFFF" strokeWidth="1.333" strokeLinejoin="round" />
          </svg>
        </button>
      }
    >
      <div style={{ maxHeight: '160px', overflowY: 'auto' }}>
        {options.map((opt) => (
          <DropdownItem
            key={opt.value}
            label={opt.label}
            selected={opt.value === value}
            onClick={() => { onChange(opt.value); setOpen(false); }}
            icon={<ModelIcon name={opt.label} />}
          />
        ))}
      </div>
    </Dropdown>
  );
}
