/**
 * @file Button.jsx
 * @structure-index
 *
 * ─── 组件职责 ───────────────────────────────────────────────────────
 *   Button 基础按钮
 *
 * ─── 更新记录 ───────────────────────────────────────────────────────
 *   2026-07-15  初始实现
 *   2026-07-15  修正仅图标尺寸、按钮字重和 Accent 渐变表现
 *   2026-07-15  修正 Primary 双层结构，确保内层完整铺满并正确显示渐变描边
 *   2026-07-15  固定 Primary 外层仅使用 1px 描边内距，避免尺寸类覆盖外层结构
 */
import { forwardRef } from 'react';

const PRIMARY_BACKGROUND_IMAGE = 'linear-gradient(148.76deg, rgba(171,255,255,0.30) 3.64%, rgba(45,195,225,0) 42.81%), linear-gradient(rgba(255,255,255,0.08))';

/**
 * 基础按钮组件
 *
 * 只负责通用视觉、尺寸、禁用和加载状态，不包含 API、Store、Toast 或业务判断。
 */
const VARIANT_STYLES = {
  accent: {
    button: 'border border-btn-accent-border bg-btn-accent-bg-normal hover:bg-btn-accent-bg-hover active:bg-btn-accent-bg-active disabled:bg-btn-accent-bg-disabled',
    content: 'text-btn-accent-text',
  },
  primary: {
    button: 'flex-col items-stretch border-0 px-0',
    content: 'w-full min-w-0 flex-1 rounded-[7px] px-[15px] bg-btn-primary-bg-normal text-text-primary group-hover:bg-btn-primary-bg-hover group-active:bg-btn-primary-bg-active group-disabled:bg-btn-primary-bg-disabled',
  },
  secondary: {
    button: 'border border-btn-primary-border bg-btn-primary-bg-normal hover:bg-btn-primary-bg-hover active:bg-btn-primary-bg-active',
    content: 'text-btn-primary-text',
  },
  danger: {
    button: 'border border-btn-danger-border bg-btn-danger-bg-normal hover:bg-btn-danger-bg-hover active:bg-btn-danger-bg-active disabled:bg-btn-danger-bg-disabled',
    content: 'text-btn-danger-text',
  },
};

const SIZE_STYLES = {
  large: {
    button: 'h-9 min-w-0 px-[16px] rounded-medium',
    primaryButton: 'h-9 min-w-0 rounded-medium',
    content: 'text-font-size-14',
    icon: 'size-4',
    iconOnly: 'size-9 px-0',
  },
  small: {
    button: 'h-6 min-w-0 px-[12px] rounded-[6px]',
    primaryButton: 'h-6 min-w-0 rounded-[6px]',
    content: 'text-font-size-12',
    icon: 'size-3',
    iconOnly: 'size-6 px-0',
  },
};

function LoadingIcon({ className }) {
  return (
    <svg
      className={`animate-spin shrink-0 ${className || ''}`}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export const Button = forwardRef(function Button(
  {
    variant = 'primary',
    size = 'large',
    icon,
    iconPosition = 'left',
    loading = false,
    disabled = false,
    iconOnly = false,
    type = 'button',
    className = '',
    contentClassName = '',
    children,
    style,
    ...props
  },
  ref,
) {
  const variantStyle = VARIANT_STYLES[variant] || VARIANT_STYLES.primary;
  const sizeStyle = SIZE_STYLES[size] || SIZE_STYLES.large;
  const isDisabled = disabled || loading;
  const iconClassName = sizeStyle.icon;
  const content = loading ? <LoadingIcon className={iconClassName} /> : icon;
  const leadingContent = iconPosition === 'right' ? children : content;
  const trailingContent = iconPosition === 'right' ? content : children;
  const isPrimary = variant === 'primary';
  const fontFamily = "'AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif";

  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      style={{
        fontFamily,
        outline: '1px solid var(--color-stroke-outline)',
        ...(variant === 'accent' ? {
          backgroundImage: 'linear-gradient(157.78deg, rgba(122,229,185,0.30) 2.88%, rgba(122,229,185,0) 56.77%)',
        } : {}),
        ...style,
        ...(isPrimary ? { padding: '1px', backgroundImage: isDisabled ? 'none' : PRIMARY_BACKGROUND_IMAGE } : {}),
      }}
      className={`group inline-flex items-center justify-center gap-[4px] shrink-0 antialiased [font-synthesis:none] font-font-weight-medium [box-shadow:var(--color-shadow)_3px_3px_8px] transition-colors disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-1 focus-visible:outline-brand-main ${isPrimary ? sizeStyle.primaryButton : sizeStyle.button} ${variantStyle.button} ${iconOnly ? sizeStyle.iconOnly : ''} ${className}`}
      {...props}
    >
      {isPrimary ? (
        <span
          className={`inline-flex items-center justify-center gap-[4px] ${sizeStyle.content} ${variantStyle.content} ${iconOnly ? 'rounded-[5px] px-0' : ''} ${contentClassName}`}
        >
          {leadingContent}
          {trailingContent}
        </span>
      ) : (
        <span className={`inline-flex items-center justify-center gap-[4px] ${sizeStyle.content} ${variantStyle.content} ${contentClassName}`}>
          {leadingContent}
          {trailingContent}
        </span>
      )}
    </button>
  );
});

export default Button;
