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
 *   2026-07-21  增加纯文本 Link 变体，仅通过文字颜色表达悬停和按下状态
 *   2026-07-21  Link 变体改为内容自适应高度并移除默认内边距
 *   2026-07-21  按设计稿完善 Secondary 的默认、悬停、按下、禁用和加载状态
 *   2026-07-21  将 Danger 统一为深色容器配红色图标和文字
 *   2026-07-22  仅图标按钮默认移除黑色 outline，保留键盘聚焦描边
 *   2026-08-04  为按钮文字补齐显式行高，修正小尺寸按钮文字的垂直居中
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
    button: 'h-9 min-w-0 rounded-[8px] px-[16px] border border-btn-primary-border bg-btn-primary-bg-normal hover:bg-btn-primary-bg-hover active:bg-btn-primary-bg-active disabled:border-0 disabled:bg-btn-primary-bg-disabled',
    content: 'text-btn-primary-text group-hover:text-white group-active:text-white group-disabled:text-[#FFFFFF33]',
  },
  link: {
    button: 'border-0 bg-transparent shadow-none p-0 cursor-pointer',
    content: 'text-brand-main transition-colors duration-[180ms] ease-out group-hover:text-[#73E6F5] group-active:text-[#73E6F5]',
  },
  danger: {
    button: 'h-9 min-w-0 rounded-[8px] px-[16px] border border-btn-danger-border bg-btn-danger-bg-normal hover:bg-btn-danger-bg-hover active:bg-btn-danger-bg-active disabled:border-0 disabled:bg-btn-danger-bg-disabled',
    content: 'text-btn-danger-text group-hover:text-btn-danger-text-hover group-active:text-btn-danger-text-hover group-disabled:text-btn-danger-text-disabled',
  },
};

const SIZE_STYLES = {
  large: {
    button: 'h-9 min-w-0 px-[16px] rounded-medium',
    primaryButton: 'h-9 min-w-0 rounded-medium',
    content: 'text-font-size-14 leading-[20px]',
    icon: 'size-4',
    iconOnly: 'size-9 px-0',
  },
  small: {
    button: 'h-6 min-w-0 px-[12px] rounded-[6px]',
    primaryButton: 'h-6 min-w-0 rounded-[6px]',
    content: 'text-font-size-12 leading-[16px]',
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
  const isLink = variant === 'link';
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
        outline: iconOnly ? 'none' : '1px solid var(--color-stroke-outline)',
        ...(variant === 'accent' ? {
          backgroundImage: 'linear-gradient(157.78deg, rgba(122,229,185,0.30) 2.88%, rgba(122,229,185,0) 56.77%)',
        } : {}),
        ...style,
        ...((variant === 'secondary' || variant === 'danger') && isDisabled ? { opacity: 1 } : {}),
        ...(variant === 'link' ? { boxShadow: 'none', outline: 'none' } : {}),
        ...(isPrimary ? { padding: '1px', backgroundImage: isDisabled ? 'none' : PRIMARY_BACKGROUND_IMAGE } : {}),
      }}
      className={`group inline-flex items-center justify-center gap-[4px] shrink-0 antialiased [font-synthesis:none] font-font-weight-medium [box-shadow:var(--color-shadow)_3px_3px_8px] transition-colors disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-1 focus-visible:outline-brand-main ${isPrimary ? sizeStyle.primaryButton : isLink ? 'h-auto min-h-0 px-0' : sizeStyle.button} ${variantStyle.button} ${iconOnly ? sizeStyle.iconOnly : ''} ${className}`}
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
