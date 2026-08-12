import { useState } from 'react';
import { Dropdown, GenTypeDropdownItem, FONT } from './CreationSelectorPrimitives';

// ─── Generation type options (backend-driven in production) ───────────────────
const GEN_TYPE_OPTIONS = [
  { value: 'image', label: '图片生成',
    iconSelected: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
        <path d="M3 5V3.188C3 2.891 3.029 2.783 3.083 2.674C3.138 2.566 3.218 2.481 3.32 2.422C3.422 2.364 3.523 2.333 3.801 2.333H12.199C12.477 2.333 12.578 2.364 12.68 2.422C12.782 2.481 12.862 2.566 12.916 2.674C12.971 2.783 13 2.891 13 3.188V5" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M1.667 5H14.333V13.667H1.667V5Z" stroke="#FFFFFF" strokeLinejoin="round" />
        <path fillRule="evenodd" clipRule="evenodd" d="M4.333 8.667C4.886 8.667 5.333 8.219 5.333 7.667C5.333 7.114 4.886 6.667 4.333 6.667C3.781 6.667 3.333 7.114 3.333 7.667C3.333 8.219 3.781 8.667 4.333 8.667Z" fill="#FFFFFF" />
        <path d="M1.856 13.463L5 10L6.667 11.333L8.667 9L14.131 13.463" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    iconDefault: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
        <path d="M3 5V3.188C3 2.891 3.029 2.783 3.083 2.674C3.138 2.566 3.218 2.481 3.32 2.422C3.422 2.364 3.523 2.333 3.801 2.333H12.199C12.477 2.333 12.578 2.364 12.68 2.422C12.782 2.481 12.862 2.566 12.916 2.674C12.971 2.783 13 2.891 13 3.188V5" stroke="#FFFFFF99" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M1.667 5H14.333V13.667H1.667V5Z" stroke="#FFFFFF99" strokeLinejoin="round" />
        <path fillRule="evenodd" clipRule="evenodd" d="M4.333 8.667C4.886 8.667 5.333 8.219 5.333 7.667C5.333 7.114 4.886 6.667 4.333 6.667C3.781 6.667 3.333 7.114 3.333 7.667C3.333 8.219 3.781 8.667 4.333 8.667Z" fill="#FFFFFF99" />
        <path d="M1.856 13.463L5 10L6.667 11.333L8.667 9L14.131 13.463" stroke="#FFFFFF99" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    triggerIcon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
        <path d="M3 5V3.188C3 2.891 3.029 2.783 3.083 2.674C3.138 2.566 3.218 2.481 3.32 2.422C3.422 2.364 3.523 2.333 3.801 2.333H12.199C12.477 2.333 12.578 2.364 12.68 2.422C12.782 2.481 12.862 2.566 12.916 2.674C12.971 2.783 13 2.891 13 3.188V5" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M1.667 5H14.333V13.667H1.667V5Z" stroke="#FFFFFFCC" strokeLinejoin="round" />
        <path fillRule="evenodd" clipRule="evenodd" d="M4.333 8.667C4.886 8.667 5.333 8.219 5.333 7.667C5.333 7.114 4.886 6.667 4.333 6.667C3.781 6.667 3.333 7.114 3.333 7.667C3.333 8.219 3.781 8.667 4.333 8.667Z" fill="#FFFFFFCC" />
        <path d="M1.856 13.463L5 10L6.667 11.333L8.667 9L14.131 13.463" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  { value: 'video', label: '视频生成',
    iconSelected: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
        <path d="M13 2H3C2.448 2 2 2.448 2 3V13C2 13.552 2.448 14 3 14H13C13.552 14 14 13.552 14 13V3C14 2.448 13.552 2 13 2Z" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M6.833 9.333V7.313L8.583 8.323L10.333 9.333L8.583 10.344L6.833 11.354V9.333Z" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M2 5H14" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M11 2L9 5" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M7 2L5 5" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    iconDefault: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
        <path d="M13 2H3C2.448 2 2 2.448 2 3V13C2 13.552 2.448 14 3 14H13C13.552 14 14 13.552 14 13V3C14 2.448 13.552 2 13 2Z" stroke="#FFFFFF99" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M6.833 9.333V7.313L8.583 8.323L10.333 9.333L8.583 10.344L6.833 11.354V9.333Z" stroke="#FFFFFF99" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M2 5H14" stroke="#FFFFFF99" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M11 2L9 5" stroke="#FFFFFF99" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M7 2L5 5" stroke="#FFFFFF99" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    triggerIcon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
        <path d="M13 2H3C2.448 2 2 2.448 2 3V13C2 13.552 2.448 14 3 14H13C13.552 14 14 13.552 14 13V3C14 2.448 13.552 2 13 2Z" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M6.833 9.333V7.313L8.583 8.323L10.333 9.333L8.583 10.344L6.833 11.354V9.333Z" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M2 5H14" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M11 2L9 5" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M7 2L5 5" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  // { value: 'dubbing', label: '配音生成', ... } // 配音选项本期隐藏，功能代码已就绪，恢复时取消此段注释
  // { value: 'music', label: '音乐生成', ... } // 音乐选项本期隐藏，功能代码已就绪，恢复时取消此段注释
];
// ─── Generation type selector ─────────────────────────────────────────────────
export function GenTypeSelector({ value, onChange, disabled }) {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const selected = GEN_TYPE_OPTIONS.find((o) => o.value === value) ?? GEN_TYPE_OPTIONS[0];
  const isActive = open || hovered;

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
      {GEN_TYPE_OPTIONS.map((opt) => (
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
