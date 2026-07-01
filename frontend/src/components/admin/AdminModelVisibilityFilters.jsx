import { ActionButton, FONT_MEDIUM, FONT_REGULAR, SelectInput, TextInput } from './adminShared';

const CATEGORY_OPTIONS = [
  { value: 'all', label: '全部分类' },
  { value: 'chat', label: '对话' },
  { value: 'image', label: '图片' },
  { value: 'video', label: '视频' },
  { value: 'voice', label: '配音' },
  { value: 'audio', label: '音频' },
];

export default function AdminModelVisibilityFilters({
  keyword,
  onKeywordChange,
  providerType,
  onProviderTypeChange,
  category,
  onCategoryChange,
  providerOptions,
  loading = false,
  onSearch,
  onReset,
}) {
  return (
    <div className="rounded-medium border border-stroke-normal bg-neutral-200 p-[16px]">
      <div className="flex flex-wrap items-center gap-[12px]">
        <div className="min-w-[280px] flex-1">
          <TextInput
            value={keyword}
            onChange={onKeywordChange}
            onKeyDown={(event) => {
              if (event.key === 'Enter') onSearch();
            }}
            placeholder="按模型名、模型 ID 或服务商搜索"
            disabled={loading}
          />
        </div>
        <div className="min-w-[180px]">
          <SelectInput
            value={providerType}
            onChange={onProviderTypeChange}
            disabled={loading}
            options={[
              { value: 'all', label: '全部服务商' },
              ...providerOptions,
            ]}
          />
        </div>
        <div className="min-w-[160px]">
          <SelectInput
            value={category}
            onChange={onCategoryChange}
            disabled={loading}
            options={CATEGORY_OPTIONS}
          />
        </div>
        <ActionButton onClick={onSearch} disabled={loading}>
          {loading ? '查询中...' : '搜索模型'}
        </ActionButton>
        <ActionButton variant="secondary" onClick={onReset} disabled={loading}>
          重置筛选
        </ActionButton>
      </div>
      <div className="mt-[10px] text-font-size-12 text-text-hint" style={{ fontFamily: FONT_REGULAR }}>
        模型开放控制只影响普通用户可见性，不改变 provider 自身启用状态。
      </div>
    </div>
  );
}
