/**
 * @file Select.jsx
 * @structure-index
 *
 * ─── 组件职责 ───────────────────────────────────────────────────────
 *   Select 受控下拉选择器，负责标签、当前值、选项菜单和 Portal 定位
 *   仅处理通用展示、鼠标/键盘交互、加载态和 onChange 回调
 *
 * ─── 依赖边界 ───────────────────────────────────────────────────────
 *   不引用页面、业务 API、Store 或业务域组件
 *   options 支持字符串数组，或 { value, label } 对象数组
 *
 * ─── 更新记录 ───────────────────────────────────────────────────────
 *   2026-07-15  从主体生图选择器提升为全局基础组件
 *   2026-07-15  增加选中项颜色、背景和菜单高度的可选视觉参数
 *   2026-07-15  增加展开态阴影和混合模式的可选视觉参数
 *   2026-07-21  增加向上展开配置，适配底部输入区
 *   2026-07-21  增加自定义菜单内容插槽，支持业务特殊选项交互
 *   2026-07-21  增加触发器和选项文本的单行省略显示
 *   2026-07-21  为被省略的长文本增加延迟 Tooltip 和自动换行
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif";

function ChevronDownIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }} aria-hidden="true">
      <path d="M12 6.333L8 10.333L4 6.333H12Z" fill="#FFFFFF" stroke="#FFFFFF" strokeWidth="1.333" strokeLinejoin="round" />
    </svg>
  );
}

function getOptionValue(option) {
  return typeof option === 'object' ? option.value : option;
}

function getOptionLabel(option) {
  return typeof option === 'object' ? option.label : option;
}

function EllipsisTooltipText({ text, style }) {
  const textRef = useRef(null);
  const timerRef = useRef(null);
  const [truncated, setTruncated] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState(null);
  const [tooltipVisible, setTooltipVisible] = useState(false);

  const measure = () => {
    if (!textRef.current) return;
    setTruncated(textRef.current.scrollWidth > textRef.current.clientWidth);
  };

  useLayoutEffect(() => {
    measure();
  }, [text]);

  useEffect(() => {
    const element = textRef.current;
    if (!element) return undefined;

    const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    resizeObserver?.observe(element);
    window.addEventListener('resize', measure);
    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', measure);
      window.clearTimeout(timerRef.current);
    };
  }, []);

  const handleMouseEnter = () => {
    if (!truncated || !text) return;
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      if (!textRef.current) return;
      const rect = textRef.current.getBoundingClientRect();
      setTooltipPosition({
        left: Math.max(108, Math.min(window.innerWidth - 108, rect.left + rect.width / 2)),
        top: rect.top - 8,
      });
      setTooltipVisible(true);
    }, 500);
  };

  const handleMouseLeave = () => {
    window.clearTimeout(timerRef.current);
    setTooltipVisible(false);
    setTooltipPosition(null);
  };

  return (
    <>
      <span
        ref={textRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={style}
      >
        {text}
      </span>
      {tooltipVisible && tooltipPosition && createPortal(
        <div
          role="tooltip"
          style={{
            position: 'fixed',
            left: `${tooltipPosition.left}px`,
            top: `${tooltipPosition.top}px`,
            transform: 'translate(-50%, -100%)',
            zIndex: 10000,
            pointerEvents: 'none',
            boxSizing: 'border-box',
            maxWidth: '200px',
            padding: '4px 8px',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '2px',
            background: '#090909',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            color: '#FFFFFF',
            fontFamily: FONT,
            fontSize: '12px',
            lineHeight: '16px',
            whiteSpace: 'normal',
            overflowWrap: 'anywhere',
            wordBreak: 'break-word',
            boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
          }}
        >
          {text}
        </div>,
        document.body,
      )}
    </>
  );
}

export default function Select({
  label,
  value = '',
  options = [],
  width = '200px',
  displayValue = value,
  loading = false,
  loadingText = '加载中…',
  disabled = false,
  selectedOptionColor = '#2DC3E1',
  selectedOptionBackground = 'rgba(45,195,225,0.08)',
  optionHoverBackground = 'rgba(255,255,255,0.06)',
  menuMaxHeight = '300px',
  menuPlacement = 'down',
  menuContent,
  openBoxShadow,
  openMixBlendMode,
  onChange,
}) {
  const [hovered, setHovered] = useState(false);
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState(null);
  const triggerRef = useRef(null);
  const dropdownRef = useRef(null);
  const hasOptions = options.length > 0;
  const isDisabled = disabled || loading || !hasOptions;

  useEffect(() => {
    if (!open) return undefined;

    function handleClickOutside(event) {
      if (
        triggerRef.current
        && !triggerRef.current.contains(event.target)
        && dropdownRef.current
        && !dropdownRef.current.contains(event.target)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const selectStyle = {
    display: 'flex', alignItems: 'center', height: '36px', width, borderRadius: '8px', padding: '0 12px', gap: '8px',
    background: hovered || open ? '#222222' : '#1D1E1E',
    border: `1px solid ${open ? 'rgba(45,195,225,0.6)' : hovered ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)'}`,
    outline: '1px solid #00000080',
    cursor: isDisabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.55 : 1,
    ...(open && openBoxShadow ? { boxShadow: openBoxShadow } : {}),
    ...(open && openMixBlendMode ? { mixBlendMode: openMixBlendMode } : {}),
    transition: 'background 100ms, border-color 100ms, opacity 100ms',
  };

  function toggleOpen() {
    if (isDisabled) return;

    const nextOpen = !open;
    if (nextOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setMenuPosition(menuPlacement === 'up'
        ? { bottom: window.innerHeight - rect.top + 4, left: rect.left, width: rect.width }
        : { top: rect.bottom + 4, left: rect.left, width: rect.width });
    }
    setOpen(nextOpen);
  }

  useEffect(() => {
    if (!open) return undefined;

    function updateMenuPosition() {
      if (!triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      setMenuPosition(menuPlacement === 'up'
        ? { bottom: window.innerHeight - rect.top + 4, left: rect.left, width: rect.width }
        : { top: rect.bottom + 4, left: rect.left, width: rect.width });
    }

    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);
    return () => {
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
    };
  }, [menuPlacement, open]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', position: 'relative', width }}>
      {label && <span style={{ fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: '#FFFFFF99' }}>{label}</span>}
      <div
        ref={triggerRef}
        role="combobox"
        tabIndex={isDisabled ? -1 : 0}
        aria-expanded={open}
        aria-disabled={isDisabled}
        style={selectStyle}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={toggleOpen}
        onKeyDown={(event) => {
          if ((event.key === 'Enter' || event.key === ' ') && !isDisabled) {
            event.preventDefault();
            toggleOpen();
          }
          if (event.key === 'Escape') setOpen(false);
        }}
      >
        <EllipsisTooltipText
          text={String(loading ? loadingText : displayValue ?? '')}
          style={{ display: 'block', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: loading ? '#FFFFFF66' : '#FFFFFF' }}
        />
        <ChevronDownIcon />
      </div>
      {open && !isDisabled && menuPosition && createPortal(
        <div
          ref={dropdownRef}
          role="listbox"
          style={{
            position: 'fixed',
            ...(menuPosition.top != null ? { top: `${menuPosition.top}px` } : {}),
            ...(menuPosition.bottom != null ? { bottom: `${menuPosition.bottom}px` } : {}),
            left: `${menuPosition.left}px`,
            width: `${menuPosition.width || 200}px`,
            zIndex: 9999,
            background: '#1D1E1E',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: '8px',
            padding: '4px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            maxHeight: menuMaxHeight,
            overflowY: 'auto',
          }}
        >
          {menuContent ? menuContent({ close: () => setOpen(false) }) : options.map((option) => {
            const optionValue = getOptionValue(option);
            const optionLabel = getOptionLabel(option);
            const selected = value === optionValue;

            return (
              <div
                key={String(optionValue)}
                role="option"
                aria-selected={selected}
                onClick={() => {
                  onChange?.(optionValue);
                  setOpen(false);
                }}
                style={{
                  padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: FONT, fontSize: '14px', lineHeight: '18px',
                  color: selected ? selectedOptionColor : '#FFFFFFCC',
                  background: selected ? selectedOptionBackground : 'transparent',
                  transition: 'background 80ms',
                }}
                onMouseEnter={(event) => { if (!selected) event.currentTarget.style.background = optionHoverBackground; }}
                onMouseLeave={(event) => { event.currentTarget.style.background = selected ? selectedOptionBackground : 'transparent'; }}
              >
                <EllipsisTooltipText
                  text={String(optionLabel ?? '')}
                  style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                />
              </div>
            );
          })}
        </div>,
        document.body,
      )}
    </div>
  );
}
