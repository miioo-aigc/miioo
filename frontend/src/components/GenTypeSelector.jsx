import { useState, memo } from 'react';
import { FONT } from '../utils/fonts';
import Dropdown from './Dropdown';
import GenTypeDropdownItem from './GenTypeDropdownItem';

function GenTypeSelector({ value, onChange, disabled, options = [] }) {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const selected = options.find((o) => o.value === value) ?? options[0];
  const isActive = open || hovered;

  if (!selected) {
    return null;
  }

  return (
    <Dropdown
      open={open}
      onClose={() => setOpen(false)}
      trigger={
        <button
          type="button"
          disabled={disabled}
          onClick={() => !disabled && setOpen((v) => !v)}
          onMouseEnter={() => !disabled && setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            height: '32px',
            paddingLeft: '12px',
            paddingRight: '6px',
            borderRadius: '8px',
            justifyContent: 'space-between',
            flexShrink: 0,
            border: '1px solid',
            cursor: disabled ? 'not-allowed' : 'pointer',
            background: open ? '#252525' : isActive ? '#222222' : '#1D1E1E',
            borderColor: open ? '#2DC3E199' : '#FFFFFF14',
            outline: open ? '1px solid #00000080' : '1px solid #00000080',
            boxShadow: open ? '#2DC3E11A 0px 0px 10px' : 'none',
            transition: 'background 0.2s, border-color 0.2s, box-shadow 0.2s',
            opacity: disabled ? 0.45 : 1,
            whiteSpace: 'nowrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {selected.triggerIcon}
            <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', color: '#FFFFFFCC' }}>
              {selected.label}
            </span>
          </div>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"
            style={{ flexShrink: 0, transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}>
            <path d="M12 6.333L8 10.333L4 6.333H12Z" fill="#FFFFFF" stroke="#FFFFFF" strokeWidth="1.333" strokeLinejoin="round" />
          </svg>
        </button>
      }
    >
      {options.map((opt) => (
        <GenTypeDropdownItem
          key={opt.value}
          label={opt.label}
          iconSelected={opt.iconSelected}
          iconDefault={opt.iconDefault}
          selected={opt.value === value}
          onClick={() => { onChange(opt.value); setOpen(false); }}
        />
      ))}
    </Dropdown>
  );
}

export default memo(GenTypeSelector);
