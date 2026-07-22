/**
 * @file TextField.jsx
 * @structure-index
 *
 * ─── 组件职责 ───────────────────────────────────────────────────────
 *   TextField 提供无业务的单行/多行受控文本输入视觉和交互
 *   支持字数统计(maxLength)、错误态(error/errorMsg)、后缀插槽(suffix)、字符过滤(sanitize)、多行高度覆盖(height)
 *
 * ─── 依赖边界 ───────────────────────────────────────────────────────
 *   只接收字段值、标签和事件回调，不调用 API、不读取 Store
 */
import { useState } from 'react';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif";
const FONT_MEDIUM = "'AlibabaPuHuiTi_2_65_Medium','Alibaba PuHuiTi 2.0',system-ui,sans-serif";

// 边框/背景 Token 口径对齐 design-system/components/input.md
function resolveBorderClass({ focused, hovered, error, disabled }) {
  if (error) return 'border-input-border-wrong';
  if (disabled) return 'border-input-border-normal';
  if (focused) return 'border-input-border-focus';
  if (hovered) return 'border-input-border-hover';
  return 'border-input-border-normal';
}

function resolveBgClass({ disabled }) {
  return disabled ? 'bg-input-bg-disabled' : 'bg-input-bg-normal';
}

export default function TextField({
  label,
  value = '',
  multiline = false,
  maxLength,
  height,
  error = false,
  errorMsg,
  suffix,
  sanitize,
  onChange,
  onBlur,
  ...inputProps
}) {
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);

  const borderClass = resolveBorderClass({ focused, hovered, error, disabled: !!inputProps.disabled });
  const bgClass = resolveBgClass({ disabled: !!inputProps.disabled });
  const glowStyle = focused && !inputProps.disabled
    ? { boxShadow: '0px 0px 10px var(--color-glow)', mixBlendMode: 'lighten' }
    : {};

  const handleChange = (e) => {
    const raw = e.target.value;
    const next = sanitize ? sanitize(raw) : raw;
    // 过滤后的真实值写回事件，避免上层用 e.target.value 拿到未过滤内容
    const patched = { ...e, target: { ...e.target, value: next } };
    onChange?.(patched);
  };

  const handleBlur = () => { setFocused(false); onBlur?.(); };

  const fieldBaseClass =
    'flex w-full rounded-medium border border-solid [outline:1px_solid_var(--color-stroke-outline)] outline-offset-0 antialiased transition-[border-color] duration-150';
  const fieldLayoutClass = multiline ? 'flex-col' : 'flex-row items-center';
  const multilineHeight = height ?? '120px';
  const fieldSizeClass = multiline
    ? `relative px-[12px] py-[9px] h-[${multilineHeight}]`
    : 'h-[36px] px-[12px]';

  const inputClass =
    'flex-1 w-full bg-transparent border-0 outline-none text-font-size-14 text-input-text-content placeholder:text-input-text-hint';
  // showCounter 必须在使用前声明，避免 const 暂时性死区（TDZ）报错
  const showCounter = typeof maxLength === 'number';
  // 多行带字数统计时，右下角计数会覆盖文字，预留底部内边距避免遮挡
  const inputPaddingClass = multiline && showCounter ? 'pb-[26px]' : '';
  const inputStyle = {
    ...(multiline ? { resize: 'none', fontFamily: FONT, lineHeight: '150%' } : { fontFamily: FONT_MEDIUM, fontWeight: 500 }),
    fontSize: '14px',
    lineHeight: multiline ? '150%' : '18px',
    color: '#FFFFFF',
  };

  const renderControl = () => {
    const commonProps = {
      value,
      maxLength,
      onChange: handleChange,
      onFocus: () => setFocused(true),
      onBlur: handleBlur,
      className: inputClass,
      style: inputStyle,
      ...inputProps,
    };
    if (!multiline) {
      commonProps.onKeyDown = (event) => {
        if (event.key === 'Enter') event.currentTarget.blur();
        inputProps.onKeyDown?.(event);
      };
    }
    return multiline
      ? <textarea {...commonProps} className={`${inputClass} ${inputPaddingClass}`} />
      : <input type="text" {...commonProps} />;
  };

  // 单行：后缀/计数在框内右侧；多行：计数绝对定位在框内右下角（不支持内嵌后缀）
  const renderSuffixOrCounter = () => {
    if (multiline) return null;
    if (suffix) return suffix;
    if (showCounter) {
      return (
        <span className="text-font-size-12 text-input-text-hint shrink-0 select-none" style={{ fontFamily: FONT }}>
          {value.length}/{maxLength}
        </span>
      );
    }
    return null;
  };

  const renderMultilineCounter = () =>
    showCounter ? (
      <span
        className="absolute right-[12px] bottom-[8px] text-font-size-12 text-input-text-hint pointer-events-none select-none"
        style={{ fontFamily: FONT }}
      >
        {value.length}/{maxLength}
      </span>
    ) : null;

  return (
    <label className="flex flex-col gap-[8px]">
      {label && (
        <span className="text-text-secondary text-font-size-14" style={{ fontFamily: FONT }}>{label}</span>
      )}
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={`${fieldBaseClass} ${fieldLayoutClass} ${fieldSizeClass} ${bgClass} ${borderClass}`}
        style={{ ...glowStyle, ...(multiline ? { height: multilineHeight, boxSizing: 'border-box' } : {}) }}
      >
        {renderControl()}
        {!multiline && renderSuffixOrCounter()}
        {multiline && renderMultilineCounter()}
      </div>
      {error && errorMsg && (
        <span className="text-status-wrong text-font-size-12 px-[12px]" style={{ fontFamily: FONT }}>
          {errorMsg}
        </span>
      )}
    </label>
  );
}
