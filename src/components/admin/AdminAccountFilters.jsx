const FONT_MEDIUM = "'AlibabaPuHuiTi_2_65_Medium','Alibaba_PuHuiTi_2.0',system-ui,sans-serif";
const FONT_REGULAR = "'AlibabaPuHuiTi 2_55 Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif";

function FilterSelect({ value, onChange, options, disabled = false }) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      className="h-[44px] min-w-[160px] rounded-medium border border-stroke-normal bg-neutral-100 px-[14px] text-font-size-14 text-text-primary outline-none transition-all focus:border-blue-alpha-60 disabled:cursor-not-allowed disabled:opacity-60"
      style={{ fontFamily: FONT_REGULAR }}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function ToolbarButton({
  children,
  onClick,
  variant = 'primary',
  disabled = false,
}) {
  const styleMap = {
    primary: 'bg-blue-300 text-neutral-500 hover:brightness-110',
    secondary: 'border border-stroke-normal bg-neutral-200 text-text-primary hover:border-white-20',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`h-[40px] rounded-medium px-[16px] text-font-size-14 transition-all ${
        styleMap[variant]
      } ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
      style={{ fontFamily: FONT_MEDIUM }}
    >
      {children}
    </button>
  );
}

export default function AdminAccountFilters({
  keyword,
  onKeywordChange,
  activeFilter,
  adminFilter,
  onActiveFilterChange,
  onAdminFilterChange,
  onSearch,
  onReset,
  loading = false,
}) {
  return (
    <div className="rounded-medium border border-stroke-normal bg-neutral-200 p-[16px]">
      <div className="flex flex-wrap items-center gap-[12px]">
        <input
          value={keyword}
          onChange={(event) => onKeywordChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              onSearch();
            }
          }}
          placeholder="按昵称、展示号或手机号搜索"
          className="h-[44px] min-w-[280px] flex-1 rounded-medium border border-stroke-normal bg-neutral-100 px-[14px] text-font-size-14 text-text-primary outline-none transition-all placeholder:text-text-hint focus:border-blue-alpha-60"
          style={{ fontFamily: FONT_REGULAR }}
        />
        <FilterSelect
          value={activeFilter}
          onChange={onActiveFilterChange}
          disabled={loading}
          options={[
            { value: 'all', label: '全部状态' },
            { value: 'active', label: '仅启用中' },
            { value: 'inactive', label: '仅已停用' },
          ]}
        />
        <FilterSelect
          value={adminFilter}
          onChange={onAdminFilterChange}
          disabled={loading}
          options={[
            { value: 'all', label: '全部权限' },
            { value: 'admin', label: '仅管理员' },
            { value: 'member', label: '仅普通用户' },
          ]}
        />
        <ToolbarButton onClick={onSearch} disabled={loading}>
          {loading ? '查询中...' : '搜索账号'}
        </ToolbarButton>
        <ToolbarButton variant="secondary" onClick={onReset} disabled={loading}>
          重置筛选
        </ToolbarButton>
      </div>
    </div>
  );
}
