import { useEffect, useRef, useState } from 'react';
import { FONT } from './CreationSelectorPrimitives';

const REF_MODE_ICON_ALL_SELECTED = (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
    <path d="M12.619 6.667V8V9.333" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M9.155 12.667L10.309 12L11.464 11.333" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M6.845 12.667L5.69 12L4.536 11.333" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M3.381 6.667V8V9.333" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M4.536 4.667L5.69 4L6.845 3.333" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M9.155 3.333L10.309 4L11.464 4.667" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M8 14.667C8.736 14.667 9.333 14.07 9.333 13.333C9.333 12.597 8.736 12 8 12C7.264 12 6.667 12.597 6.667 13.333C6.667 14.07 7.264 14.667 8 14.667Z" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M8 4C8.736 4 9.333 3.403 9.333 2.667C9.333 1.93 8.736 1.333 8 1.333C7.264 1.333 6.667 1.93 6.667 2.667C6.667 3.403 7.264 4 8 4Z" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M8 9.333C8.736 9.333 9.333 8.736 9.333 8C9.333 7.264 8.736 6.667 8 6.667C7.264 6.667 6.667 7.264 6.667 8C6.667 8.736 7.264 9.333 8 9.333Z" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M12.667 6.667C13.403 6.667 14 6.07 14 5.333C14 4.597 13.403 4 12.667 4C11.93 4 11.333 4.597 11.333 5.333C11.333 6.07 11.93 6.667 12.667 6.667Z" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M12.667 12C13.403 12 14 11.403 14 10.667C14 9.93 13.403 9.333 12.667 9.333C11.93 9.333 11.333 9.93 11.333 10.667C11.333 11.403 11.93 12 12.667 12Z" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M3.333 6.667C4.07 6.667 4.667 6.07 4.667 5.333C4.667 4.597 4.07 4 3.333 4C2.597 4 2 4.597 2 5.333C2 6.07 2.597 6.667 3.333 6.667Z" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M3.333 12C4.07 12 4.667 11.403 4.667 10.667C4.667 9.93 4.07 9.333 3.333 9.333C2.597 9.333 2 9.93 2 10.667C2 11.403 2.597 12 3.333 12Z" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const REF_MODE_ICON_ALL_DEFAULT = (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
    <path d="M12.619 6.667V8V9.333" stroke="#FFFFFF99" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M9.155 12.667L10.309 12L11.464 11.333" stroke="#FFFFFF99" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M6.845 12.667L5.69 12L4.536 11.333" stroke="#FFFFFF99" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M3.381 6.667V8V9.333" stroke="#FFFFFF99" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M4.536 4.667L5.69 4L6.845 3.333" stroke="#FFFFFF99" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M9.155 3.333L10.309 4L11.464 4.667" stroke="#FFFFFF99" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M8 14.667C8.736 14.667 9.333 14.07 9.333 13.333C9.333 12.597 8.736 12 8 12C7.264 12 6.667 12.597 6.667 13.333C6.667 14.07 7.264 14.667 8 14.667Z" stroke="#FFFFFF99" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M8 4C8.736 4 9.333 3.403 9.333 2.667C9.333 1.93 8.736 1.333 8 1.333C7.264 1.333 6.667 1.93 6.667 2.667C6.667 3.403 7.264 4 8 4Z" stroke="#FFFFFF99" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M8 9.333C8.736 9.333 9.333 8.736 9.333 8C9.333 7.264 8.736 6.667 8 6.667C7.264 6.667 6.667 7.264 6.667 8C6.667 8.736 7.264 9.333 8 9.333Z" stroke="#FFFFFF99" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M12.667 6.667C13.403 6.667 14 6.07 14 5.333C14 4.597 13.403 4 12.667 4C11.93 4 11.333 4.597 11.333 5.333C11.333 6.07 11.93 6.667 12.667 6.667Z" stroke="#FFFFFF99" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M12.667 12C13.403 12 14 11.403 14 10.667C14 9.93 13.403 9.333 12.667 9.333C11.93 9.333 11.333 9.93 11.333 10.667C11.333 11.403 11.93 12 12.667 12Z" stroke="#FFFFFF99" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M3.333 6.667C4.07 6.667 4.667 6.07 4.667 5.333C4.667 4.597 4.07 4 3.333 4C2.597 4 2 4.597 2 5.333C2 6.07 2.597 6.667 3.333 6.667Z" stroke="#FFFFFF99" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M3.333 12C4.07 12 4.667 11.403 4.667 10.667C4.667 9.93 4.07 9.333 3.333 9.333C2.597 9.333 2 9.93 2 10.667C2 11.403 2.597 12 3.333 12Z" stroke="#FFFFFF99" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const REF_MODE_ICON_FRAME_DEFAULT = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '16px', height: '16px', flexShrink: 0 }}>
    <path d="M9.446 1.733C9.888 1.733 10.246 2.092 10.246 2.533V21.855C10.246 22.297 9.888 22.655 9.447 22.655C9.005 22.655 8.646 22.297 8.646 21.855V2.533C8.646 2.092 9.005 1.733 9.447 1.733H9.446Z" fill="#FFFFFF99" />
    <path d="M9.194 3.483V5.083H4.706C4.411 5.083 4.172 5.322 4.172 5.617V18.946C4.172 19.241 4.411 19.479 4.706 19.479H9.194V21.079H4.706C3.527 21.079 2.572 20.124 2.572 18.946V5.617C2.572 4.438 3.527 3.483 4.706 3.483H9.194Z" fill="#FFFFFF99" />
    <path d="M3.814 8.787H9.446V7.187H3.814V8.787ZM3.814 17.402H9.446V15.802H3.814V17.402ZM14.706 1.733C14.264 1.733 13.906 2.092 13.906 2.533V21.855C13.906 22.297 14.264 22.655 14.706 22.655C15.148 22.655 15.506 22.297 15.506 21.855V2.533C15.506 2.092 15.148 1.733 14.706 1.733Z" fill="#FFFFFF99" />
    <path d="M14.957 3.483V5.083H19.446C19.74 5.083 19.979 5.322 19.979 5.617V18.946C19.979 19.241 19.74 19.479 19.446 19.479H14.957V21.079H19.446C20.624 21.079 21.579 20.124 21.579 18.946V5.617C21.579 4.438 20.624 3.483 19.446 3.483H14.957Z" fill="#FFFFFF99" />
    <path d="M20.339 8.787H14.707V7.187H20.339V8.787ZM20.339 17.402H14.707V15.802H20.339V17.402Z" fill="#FFFFFF99" />
  </svg>
);
const REF_MODE_ICON_FRAME_SELECTED = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '16px', height: '16px', flexShrink: 0 }}>
    <path d="M9.446 1.733C9.888 1.733 10.246 2.092 10.246 2.533V21.855C10.246 22.297 9.888 22.655 9.447 22.655C9.005 22.655 8.646 22.297 8.646 21.855V2.533C8.646 2.092 9.005 1.733 9.447 1.733H9.446Z" fill="#FFFFFF" />
    <path d="M9.194 3.483V5.083H4.706C4.411 5.083 4.172 5.322 4.172 5.617V18.946C4.172 19.241 4.411 19.479 4.706 19.479H9.194V21.079H4.706C3.527 21.079 2.572 20.124 2.572 18.946V5.617C2.572 4.438 3.527 3.483 4.706 3.483H9.194Z" fill="#FFFFFF" />
    <path d="M3.814 8.787H9.446V7.187H3.814V8.787ZM3.814 17.402H9.446V15.802H3.814V17.402ZM14.706 1.733C14.264 1.733 13.906 2.092 13.906 2.533V21.855C13.906 22.297 14.264 22.655 14.706 22.655C15.148 22.655 15.506 22.297 15.506 21.855V2.533C15.506 2.092 15.148 1.733 14.706 1.733Z" fill="#FFFFFF" />
    <path d="M14.957 3.483V5.083H19.446C19.74 5.083 19.979 5.322 19.979 5.617V18.946C19.979 19.241 19.74 19.479 19.446 19.479H14.957V21.079H19.446C20.624 21.079 21.579 20.124 21.579 18.946V5.617C21.579 4.438 20.624 3.483 19.446 3.483H14.957Z" fill="#FFFFFF" />
    <path d="M20.339 8.787H14.707V7.187H20.339V8.787ZM20.339 17.402H14.707V15.802H20.339V17.402Z" fill="#FFFFFF" />
  </svg>
);
const REF_MODE_ICON_MULTI_DEFAULT = (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
    <path d="M8 8V4M8 8L4.5 10.021M8 8L11.5 10.021" stroke="#FFFFFF99" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M4.667 5.333C4.667 6.07 4.07 6.667 3.333 6.667C2.597 6.667 2 6.07 2 5.333C2 4.597 2.597 4 3.333 4C4.07 4 4.667 4.597 4.667 5.333Z" stroke="#FFFFFF99" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M4.667 10.667C4.667 11.403 4.07 12 3.333 12C2.597 12 2 11.403 2 10.667C2 9.93 2.597 9.333 3.333 9.333C4.07 9.333 4.667 9.93 4.667 10.667Z" stroke="#FFFFFF99" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M9.333 13.333C9.333 14.07 8.736 14.667 8 14.667C7.264 14.667 6.667 14.07 6.667 13.333C6.667 12.597 7.264 12 8 12C8.736 12 9.333 12.597 9.333 13.333Z" stroke="#FFFFFF99" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M14 10.667C14 11.403 13.403 12 12.667 12C11.93 12 11.333 11.403 11.333 10.667C11.333 9.93 11.93 9.333 12.667 9.333C13.403 9.333 14 9.93 14 10.667Z" stroke="#FFFFFF99" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M14 5.333C14 6.07 13.403 6.667 12.667 6.667C11.93 6.667 11.333 6.07 11.333 5.333C11.333 4.597 11.93 4 12.667 4C13.403 4 14 4.597 14 5.333Z" stroke="#FFFFFF99" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M9.333 2.667C9.333 3.403 8.736 4 8 4C7.264 4 6.667 3.403 6.667 2.667C6.667 1.93 7.264 1.333 8 1.333C8.736 1.333 9.333 1.93 9.333 2.667Z" stroke="#FFFFFF99" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const REF_MODE_ICON_MULTI_SELECTED = (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
    <path d="M8 8V4M8 8L4.5 10.021M8 8L11.5 10.021" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M4.667 5.333C4.667 6.07 4.07 6.667 3.333 6.667C2.597 6.667 2 6.07 2 5.333C2 4.597 2.597 4 3.333 4C4.07 4 4.667 4.597 4.667 5.333Z" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M4.667 10.667C4.667 11.403 4.07 12 3.333 12C2.597 12 2 11.403 2 10.667C2 9.93 2.597 9.333 3.333 9.333C4.07 9.333 4.667 9.93 4.667 10.667Z" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M9.333 13.333C9.333 14.07 8.736 14.667 8 14.667C7.264 14.667 6.667 14.07 6.667 13.333C6.667 12.597 7.264 12 8 12C8.736 12 9.333 12.597 9.333 13.333Z" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M14 10.667C14 11.403 13.403 12 12.667 12C11.93 12 11.333 11.403 11.333 10.667C11.333 9.93 11.93 9.333 12.667 9.333C13.403 9.333 14 9.93 14 10.667Z" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M14 5.333C14 6.07 13.403 6.667 12.667 6.667C11.93 6.667 11.333 6.07 11.333 5.333C11.333 4.597 11.93 4 12.667 4C13.403 4 14 4.597 14 5.333Z" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M9.333 2.667C9.333 3.403 8.736 4 8 4C7.264 4 6.667 3.403 6.667 2.667C6.667 1.93 7.264 1.333 8 1.333C8.736 1.333 9.333 1.93 9.333 2.667Z" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// Icon map for ref modes — icons are static frontend assets, not from backend
const REF_MODE_ICON_MAP = {
  all:   { iconSelected: REF_MODE_ICON_ALL_SELECTED,    iconDefault: REF_MODE_ICON_ALL_DEFAULT,    triggerIcon: REF_MODE_ICON_ALL_SELECTED    },
  frame: { iconSelected: REF_MODE_ICON_FRAME_SELECTED,  iconDefault: REF_MODE_ICON_FRAME_DEFAULT,  triggerIcon: REF_MODE_ICON_FRAME_SELECTED  },
  multi: { iconSelected: REF_MODE_ICON_MULTI_SELECTED,  iconDefault: REF_MODE_ICON_MULTI_DEFAULT,  triggerIcon: REF_MODE_ICON_MULTI_SELECTED  },
};

// ─── Reference mode selector ──────────────────────────────────────────────────
export function RefModeSelector({ value, onChange, disabled, options = [] }) {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const dropdownRef = useRef(null);
  const selectedOpt = options.find((o) => o.value === value) ?? options[0];
  const selectedIcons = REF_MODE_ICON_MAP[selectedOpt?.value] ?? REF_MODE_ICON_MAP.all;
  const isActive = open || hovered;

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
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
          outline: '1px solid #00000080',
          boxShadow: open ? '#2DC3E11A 0px 0px 10px' : 'none',
          transition: 'background 0.2s, border-color 0.2s, box-shadow 0.2s',
          opacity: disabled ? 0.45 : 1,
          whiteSpace: 'nowrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {selectedIcons.triggerIcon}
          <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', color: '#FFFFFFCC' }}>
            {selectedOpt?.label}
          </span>
        </div>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"
          style={{ flexShrink: 0, transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}>
          <path d="M12 6.333L8 10.333L4 6.333H12Z" fill="#FFFFFF" stroke="#FFFFFF" strokeWidth="1.333" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div style={{
          position: 'absolute',
          zIndex: 50,
          left: 0,
          bottom: 'calc(100% + 4px)',
          borderRadius: '8px',
          background: '#1D1E1E',
          border: '1px solid #FFFFFF0D',
          boxShadow: '0px 4px 16px #00000066',
          width: '112px',
          padding: '4px',
          display: 'flex',
          flexDirection: 'column',
          gap: '0px',
        }}>
          {options.map((opt) => {
            const sel = opt.value === value;
            const icons = REF_MODE_ICON_MAP[opt.value] ?? REF_MODE_ICON_MAP.all;
            return (
              <RefModeDropdownItem
                key={opt.value}
                label={opt.label}
                icon={sel ? icons.iconSelected : icons.iconDefault}
                selected={sel}
                onClick={() => { onChange(opt.value); setOpen(false); }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function RefModeDropdownItem({ label, icon, selected, onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        width: '100%',
        paddingLeft: '12px',
        paddingRight: '12px',
        paddingTop: '8px',
        paddingBottom: '8px',
        borderRadius: '6px',
        cursor: 'pointer',
        border: 'none',
        textAlign: 'left',
        fontFamily: FONT,
        fontSize: '14px',
        lineHeight: '18px',
        color: selected ? '#FFFFFFCC' : '#FFFFFF99',
        background: selected ? '#FFFFFF0D' : hovered ? '#FFFFFF0A' : 'transparent',
        transition: 'background 0.15s',
      }}
    >
      {icon}
      <span style={{ flex: 1 }}>{label}</span>
    </button>
  );
}

