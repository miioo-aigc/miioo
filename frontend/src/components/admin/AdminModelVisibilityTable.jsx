import {
  PaginationControls,
  Toggle,
} from './adminShared';
import { FONT_MEDIUM, FONT_REGULAR, formatTime } from './adminSharedUtils';

const MODEL_CATEGORY_LABELS = {
  chat: '对话',
  image: '图片',
  video: '视频',
  audio: '音频',
  voice: '配音',
};

export default function AdminModelVisibilityTable({
  items,
  total,
  page,
  pageSize,
  hasMore,
  loading = false,
  savingKey = '',
  onPrev,
  onNext,
  onToggle,
}) {
  if (!items.length) {
    return (
      <div className="rounded-medium border border-dashed border-stroke-normal bg-neutral-200 px-[16px] py-[24px] text-center text-font-size-14 text-text-secondary" style={{ fontFamily: FONT_REGULAR }}>
        {loading ? '模型开放列表加载中...' : '当前没有匹配到模型'}
      </div>
    );
  }

  return (
    <div className="rounded-medium border border-stroke-normal bg-neutral-200">
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="border-b border-stroke-normal bg-neutral-300 text-left">
              {['模型', '服务商', '分类', '模型 ID', '最近更新时间', '普通用户可见', '操作'].map((label) => (
                <th
                  key={label}
                  className="px-[16px] py-[14px] text-font-size-12 text-text-hint"
                  style={{ fontFamily: FONT_MEDIUM }}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const rowSavingKey = `${item.providerType}:${item.category}:${item.modelId}`;
              const saving = savingKey === rowSavingKey;
              return (
                <tr key={rowSavingKey} className="border-b border-stroke-normal last:border-b-0">
                  <td className="px-[16px] py-[16px]">
                    <div className="min-w-[180px]">
                      <div className="text-font-size-14 text-text-primary" style={{ fontFamily: FONT_MEDIUM }}>
                        {item.name}
                      </div>
                    </div>
                  </td>
                  <td className="px-[16px] py-[16px] text-font-size-13 text-text-secondary" style={{ fontFamily: FONT_REGULAR }}>
                    {item.providerName}
                  </td>
                  <td className="px-[16px] py-[16px] text-font-size-13 text-text-secondary" style={{ fontFamily: FONT_REGULAR }}>
                    {MODEL_CATEGORY_LABELS[item.category] || item.category}
                  </td>
                  <td className="px-[16px] py-[16px] text-font-size-12 text-text-secondary" style={{ fontFamily: FONT_REGULAR }}>
                    <span className="break-all">{item.modelId}</span>
                  </td>
                  <td className="px-[16px] py-[16px] text-font-size-12 text-text-secondary" style={{ fontFamily: FONT_REGULAR }}>
                    {formatTime(item.updatedAt)}
                  </td>
                  <td className="px-[16px] py-[16px]">
                    <span
                      className={`rounded-[999px] px-[10px] py-[4px] text-font-size-12 ${
                        item.isVisible ? 'bg-blue-alpha-20 text-blue-200' : 'bg-red-alpha-10 text-red-300'
                      }`}
                      style={{ fontFamily: FONT_REGULAR }}
                    >
                      {item.isVisible ? '开放中' : '已关闭'}
                    </span>
                  </td>
                  <td className="px-[16px] py-[16px]">
                    <div className="flex items-center gap-[12px]">
                      <Toggle
                        checked={item.isVisible}
                        disabled={loading || saving}
                        onChange={(nextVisible) => onToggle(item, nextVisible)}
                      />
                      <span className="text-font-size-12 text-text-hint" style={{ fontFamily: FONT_REGULAR }}>
                        {saving ? '保存中...' : item.isVisible ? '点此关闭' : '点此开放'}
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <PaginationControls
        page={page}
        pageSize={pageSize}
        total={total}
        hasMore={hasMore}
        loading={loading}
        onPrev={onPrev}
        onNext={onNext}
      />
    </div>
  );
}
