/**
 * @file DropdownMenu.jsx
 * @structure-index
 *
 * ─── 组件职责 ───────────────────────────────────────────────────────
 *   DropdownMenu       通用操作菜单面板与菜单项交互
 *   DropdownMenuItem   纯文本、图标、右侧图标和二级菜单项
 *
 * ─── 更新记录 ───────────────────────────────────────────────────────
 *   2026-07-22  按标准菜单元素新增通用下拉菜单组件
 */
import { useEffect, useRef, useState } from 'react';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif";

function ChevronRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M6 3.333L10.667 8L6 12.667" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DropdownMenuItem({ item, onClose, openSubmenuKey, onOpenSubmenu }) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const disabled = item.disabled === true;
  const submenuItems = Array.isArray(item.items) ? item.items : null;
  const hasSubmenu = submenuItems?.length > 0;
  const itemKey = item.key || item.label;
  const submenuOpen = openSubmenuKey === itemKey;
  const active = hovered || pressed;

  function handleClick(event) {
    event.stopPropagation();
    if (disabled) return;
    if (hasSubmenu) {
      onOpenSubmenu?.(submenuOpen ? null : itemKey);
      return;
    }
    onClose?.();
    item.onClick?.(item);
  }

  return (
    <div
      style={{ position: 'relative' }}
      onMouseEnter={() => !disabled && hasSubmenu && onOpenSubmenu?.(itemKey)}
    >
      <button
        type="button"
        role="menuitem"
        disabled={disabled}
        aria-haspopup={hasSubmenu ? 'menu' : undefined}
        aria-expanded={hasSubmenu ? submenuOpen : undefined}
        className="flex w-full items-center rounded-[6px] border-0 bg-transparent text-left"
        style={{
          padding: '8px 12px',
          gap: '4px',
          justifyContent: item.endIcon || hasSubmenu ? 'space-between' : 'flex-start',
          backgroundColor: active ? '#FFFFFF14' : 'transparent',
          color: disabled ? '#FFFFFF33' : item.danger ? '#F75F5F' : '#FFFFFFCC',
          cursor: disabled ? 'not-allowed' : 'pointer',
          fontFamily: FONT,
          fontSize: '14px',
          lineHeight: '18px',
          outline: 'none',
          transition: 'background-color 120ms, color 120ms',
        }}
        onMouseEnter={() => !disabled && setHovered(true)}
        onFocus={() => !disabled && hasSubmenu && onOpenSubmenu?.(itemKey)}
        onMouseLeave={() => {
          setHovered(false);
          setPressed(false);
        }}
        onMouseDown={() => !disabled && setPressed(true)}
        onMouseUp={() => setPressed(false)}
        onClick={handleClick}
      >
        {item.icon && <span style={{ display: 'inline-flex', width: '16px', height: '16px', flexShrink: 0 }}>{item.icon}</span>}
        <span style={{ flex: 1, minWidth: 0 }}>{item.label}</span>
        {(item.endIcon || hasSubmenu) && (
          <span style={{ display: 'inline-flex', width: '16px', height: '16px', flexShrink: 0 }}>
            {item.endIcon || <ChevronRightIcon />}
          </span>
        )}
      </button>
      {hasSubmenu && submenuOpen && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            top: '-5px',
            left: 'calc(100% + 4px)',
            zIndex: 1,
            width: '178px',
            boxSizing: 'border-box',
            backgroundColor: '#161616',
            border: '1px solid rgba(255,255,255,0.05)',
            borderRadius: '8px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
            padding: '4px',
          }}
        >
          {submenuItems.map((submenuItem, index) => (
            <DropdownMenuItem
              key={submenuItem.key || submenuItem.label || index}
              item={submenuItem}
              onClose={onClose}
              openSubmenuKey={openSubmenuKey}
              onOpenSubmenu={onOpenSubmenu}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function DropdownMenu({ items = [], onClose, width = '178px', style, className = '' }) {
  const menuRef = useRef(null);
  const [openSubmenuKey, setOpenSubmenuKey] = useState(null);

  useEffect(() => {
    function handleOutsideClick(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) onClose?.();
    }

    function handleEscape(event) {
      if (event.key === 'Escape') onClose?.();
    }

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      role="menu"
      className={`flex flex-col items-stretch rounded-[8px] ${className}`}
      style={{
        position: 'absolute',
        bottom: '100%',
        right: 0,
        marginBottom: '4px',
        zIndex: 50,
        width,
        boxSizing: 'border-box',
        backgroundColor: '#161616',
        border: '1px solid rgba(255,255,255,0.05)',
        boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        padding: '4px',
        ...style,
      }}
    >
      {items.map((item, index) => (
        <DropdownMenuItem
          key={item.key || item.label || index}
          item={item}
          onClose={onClose}
          openSubmenuKey={openSubmenuKey}
          onOpenSubmenu={setOpenSubmenuKey}
        />
      ))}
    </div>
  );
}
