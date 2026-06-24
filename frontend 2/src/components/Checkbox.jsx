import { useState } from 'react';

/**
 * Unified checkbox component per design-system spec (Paper D6-0).
 *
 * States: normal, hover, active (checked), half-choosen (indeterminate),
 *         disabled, checked-disabled.
 *
 * Two modes:
 * - Interactive: pass `onChange` → component manages its own `hovered` state.
 * - Passive: omit `onChange` → parent controls `hovered` prop.
 */
export default function Checkbox({
  checked = false,
  indeterminate = false,
  disabled = false,
  hovered: hoveredProp,
  onChange,
  className = '',
  style,
}) {
  const [hoveredInternal, setHoveredInternal] = useState(false);
  const interactive = typeof onChange === 'function';
  const hovered = interactive ? hoveredInternal : !!hoveredProp;

  const isOn = checked || indeterminate;

  // Background
  let bgClass;
  if (isOn && disabled) {
    bgClass = 'bg-checkbox-bg-disabled-active';
  } else if (isOn) {
    bgClass = 'bg-checkbox-bg-active';
  } else if (disabled) {
    bgClass = 'bg-checkbox-bg-disabled';
  } else if (hovered) {
    bgClass = 'bg-checkbox-bg-hover';
  } else {
    bgClass = 'bg-checkbox-bg-normal';
  }

  // Border
  let borderClass;
  if (disabled) {
    borderClass = 'border-checkbox-border-disabled';
  } else if (hovered && !isOn) {
    borderClass = 'border-checkbox-border-hover';
  } else {
    borderClass = 'border-checkbox-border-active';
  }

  return (
    <div
      className={`flex items-center border border-solid ${bgClass} ${borderClass} rounded relative shrink-0 ${className}`}
      style={{
        width: '16px',
        height: '16px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        outline: '1px solid var(--color-stroke-outline)',
        outlineOffset: 0,
        ...style,
      }}
      onClick={interactive && !disabled ? onChange : undefined}
      onMouseEnter={interactive && !disabled ? () => setHoveredInternal(true) : undefined}
      onMouseLeave={interactive ? () => setHoveredInternal(false) : undefined}
      role="checkbox"
      aria-checked={indeterminate ? 'mixed' : checked}
      aria-disabled={disabled}
    >
      {checked && (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"
          style={{ position: 'absolute', left: '50%', top: '50%', translate: '-50% -50%' }}>
          <path d="M3.333 8L6.667 11.333L13.333 4.667" stroke="#090909" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      {indeterminate && (
        <div style={{
          position: 'absolute', left: '50%', top: '50%', translate: '-50% -50%',
          width: '10px', height: '1.5px', backgroundColor: '#090909', borderRadius: '9999px',
        }} />
      )}
    </div>
  );
}
