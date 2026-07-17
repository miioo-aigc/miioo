import { FONT_MEDIUM, FONT_REGULAR } from './adminSharedUtils';

export function Toggle({ checked, onChange, disabled = false }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        if (!disabled) onChange(!checked);
      }}
      className={`relative inline-flex h-[28px] w-[48px] shrink-0 items-center rounded-full border transition-all ${
        checked
          ? 'border-blue-alpha-60 bg-blue-300'
          : 'border-stroke-normal bg-neutral-500'
      } ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
      aria-pressed={checked}
    >
      <span
        className={`absolute h-[22px] w-[22px] rounded-full bg-white transition-transform ${
          checked ? 'translate-x-[22px]' : 'translate-x-[4px]'
        }`}
      />
    </button>
  );
}

export function ActionButton({
  children,
  onClick,
  variant = 'primary',
  disabled = false,
  className = '',
  type = 'button',
}) {
  const styleMap = {
    primary: 'bg-blue-300 text-neutral-500 hover:brightness-110',
    secondary: 'bg-neutral-200 text-text-primary border border-stroke-normal hover:border-white-20',
    danger: 'bg-red-alpha-20 text-red-300 border border-red-alpha-40 hover:border-red-alpha-60',
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`h-[40px] rounded-medium px-[16px] text-font-size-14 transition-all ${styleMap[variant]} ${
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
      } ${className}`}
      style={{ fontFamily: FONT_MEDIUM }}
    >
      {children}
    </button>
  );
}

export function TextInput({
  value,
  onChange,
  placeholder,
  type = 'text',
  accept,
  min,
  disabled = false,
  onKeyDown,
}) {
  return (
    <input
      value={value}
      type={type}
      min={min}
      accept={accept}
      disabled={disabled}
      onKeyDown={onKeyDown}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="h-[44px] w-full rounded-medium border border-stroke-normal bg-neutral-100 px-[14px] text-font-size-14 text-text-primary outline-none transition-all placeholder:text-text-hint focus:border-blue-alpha-60 disabled:cursor-not-allowed disabled:opacity-60"
      style={{ fontFamily: FONT_REGULAR }}
    />
  );
}

export function SelectInput({ value, options, onChange, disabled = false }) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      className="h-[44px] w-full rounded-medium border border-stroke-normal bg-neutral-100 px-[14px] text-font-size-14 text-text-primary outline-none transition-all focus:border-blue-alpha-60 disabled:cursor-not-allowed disabled:opacity-60"
      style={{ fontFamily: FONT_REGULAR }}
    >
      {options.map((option) => (
        <option key={`${option.value}-${option.label}`} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export function TextArea({ value, onChange, placeholder, rows = 3 }) {
  return (
    <textarea
      rows={rows}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="w-full rounded-medium border border-stroke-normal bg-neutral-100 px-[14px] py-[12px] text-font-size-14 text-text-primary outline-none transition-all placeholder:text-text-hint focus:border-blue-alpha-60"
      style={{ fontFamily: FONT_REGULAR, resize: 'vertical' }}
    />
  );
}

export function FieldLabel({ children }) {
  return (
    <div className="mb-[8px] text-font-size-12 text-text-hint" style={{ fontFamily: FONT_REGULAR }}>
      {children}
    </div>
  );
}

export function StatusPill({ enabled, enabledLabel = '启用中', disabledLabel = '已停用' }) {
  return (
    <span
      className={`rounded-[999px] px-[10px] py-[4px] text-font-size-12 ${
        enabled ? 'bg-blue-alpha-20 text-blue-200' : 'bg-red-alpha-10 text-red-300'
      }`}
      style={{ fontFamily: FONT_REGULAR }}
    >
      {enabled ? enabledLabel : disabledLabel}
    </span>
  );
}

export function PaginationControls({
  page,
  pageSize,
  total,
  hasMore,
  loading = false,
  onPrev,
  onNext,
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-[12px] border-t border-stroke-normal px-[16px] py-[14px]">
      <div className="text-font-size-12 text-text-hint" style={{ fontFamily: FONT_REGULAR }}>
        共 {total} 条，每页 {pageSize} 条
      </div>
      <div className="flex items-center gap-[8px]">
        <span className="text-font-size-12 text-text-hint" style={{ fontFamily: FONT_REGULAR }}>
          第 {page} 页
        </span>
        <ActionButton variant="secondary" onClick={onPrev} disabled={loading || page <= 1} className="h-[32px] px-[12px] text-font-size-12">
          上一页
        </ActionButton>
        <ActionButton variant="secondary" onClick={onNext} disabled={loading || !hasMore} className="h-[32px] px-[12px] text-font-size-12">
          下一页
        </ActionButton>
      </div>
    </div>
  );
}

export function EmptyState({ message }) {
  return (
    <div
      className="flex min-h-[180px] items-center justify-center rounded-medium border border-dashed border-stroke-normal bg-neutral-200 px-[16px] text-center text-font-size-14 text-text-secondary"
      style={{ fontFamily: FONT_REGULAR }}
    >
      {message}
    </div>
  );
}

export function SectionShell({ title, description, extra, children }) {
  return (
    <div className="rounded-medium border border-stroke-normal bg-neutral-300 p-[20px]">
      <div className="flex flex-wrap items-end justify-between gap-[12px]">
        <div>
          <div className="text-[18px] leading-[22px] text-text-primary" style={{ fontFamily: FONT_MEDIUM }}>
            {title}
          </div>
          {description ? (
            <div className="mt-[8px] text-font-size-14 text-text-secondary" style={{ fontFamily: FONT_REGULAR }}>
              {description}
            </div>
          ) : null}
        </div>
        {extra}
      </div>
      <div className="mt-[16px]">{children}</div>
    </div>
  );
}
