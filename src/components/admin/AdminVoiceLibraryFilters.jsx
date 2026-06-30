import { ActionButton, FONT_REGULAR, TextInput } from './adminShared';

const STATUS_FILTERS = [
  { key: 'all', label: '全部音色' },
  { key: 'enabled', label: '启用中' },
  { key: 'disabled', label: '已停用' },
];

export default function AdminVoiceLibraryFilters({
  keyword,
  onKeywordChange,
  statusFilter,
  onStatusFilterChange,
  onSearch,
  onReset,
  onCreate,
  loading = false,
  creatingDisabled = false,
}) {
  return (
    <div className="rounded-medium border border-stroke-normal bg-neutral-200 p-[16px]">
      <div className="flex flex-wrap items-center gap-[8px]">
        <div className="min-w-[280px] flex-1">
          <TextInput
            value={keyword}
            onChange={onKeywordChange}
            onKeyDown={(event) => {
              if (event.key === 'Enter') onSearch();
            }}
            placeholder="按名称、风格或情绪标签搜索 miioo 音色"
            disabled={loading}
          />
        </div>
        <ActionButton onClick={onSearch} disabled={loading}>
          {loading ? '查询中...' : '搜索音色'}
        </ActionButton>
        <ActionButton variant="secondary" onClick={onReset} disabled={loading}>
          重置搜索
        </ActionButton>
        <ActionButton onClick={onCreate} disabled={loading || creatingDisabled}>
          新增音色
        </ActionButton>
      </div>
      <div className="mt-[16px] flex flex-wrap gap-[8px]">
        {STATUS_FILTERS.map((filter) => (
          <button
            key={filter.key}
            type="button"
            onClick={() => onStatusFilterChange(filter.key)}
            className={`rounded-[999px] border px-[12px] py-[8px] text-font-size-13 transition-all ${
              statusFilter === filter.key
                ? 'border-blue-alpha-60 bg-blue-alpha-20 text-blue-200'
                : 'border-stroke-normal bg-neutral-300 text-text-secondary'
            }`}
            style={{ fontFamily: FONT_REGULAR }}
          >
            {filter.label}
          </button>
        ))}
      </div>
    </div>
  );
}
