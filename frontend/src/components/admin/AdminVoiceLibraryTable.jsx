import {
  ActionButton,
  FONT_MEDIUM,
  FONT_REGULAR,
  PaginationControls,
  StatusPill,
  formatTime,
} from './adminShared';

export default function AdminVoiceLibraryTable({
  items,
  total,
  page,
  pageSize,
  hasMore,
  loading = false,
  playingKey = '',
  deletingKey = '',
  getItemPlayingKey,
  resolveVoiceName,
  getPreviewUrl,
  onTogglePlay,
  onEdit,
  onDisable,
  onPrev,
  onNext,
}) {
  if (!items.length) {
    return (
      <div className="rounded-medium border border-dashed border-stroke-normal bg-neutral-200 px-[16px] py-[24px] text-center text-font-size-14 text-text-secondary" style={{ fontFamily: FONT_REGULAR }}>
        {loading ? '音色库加载中...' : '当前没有匹配到音色'}
      </div>
    );
  }

  return (
    <div className="rounded-medium border border-stroke-normal bg-neutral-200">
      <div className="grid gap-[12px] p-[16px] lg:grid-cols-2">
        {items.map((item) => {
          const previewUrl = getPreviewUrl(item);
          const rowPlayingKey = getItemPlayingKey(item);
          const voiceName = resolveVoiceName(item);
          return (
            <div key={item.id} className="rounded-medium border border-stroke-normal bg-neutral-300 p-[16px]">
              <div className="flex items-start justify-between gap-[12px]">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-[8px]">
                    <div className="truncate text-[16px] leading-[20px] text-text-primary" style={{ fontFamily: FONT_MEDIUM }}>
                      {voiceName}
                    </div>
                    <StatusPill enabled={Boolean(item.is_enabled)} />
                  </div>
                  <div className="mt-[8px] flex flex-wrap gap-[8px] text-font-size-12 text-text-hint" style={{ fontFamily: FONT_REGULAR }}>
                    <span>名称：{item.name || '未命名'}</span>
                    <span>排序：{item.sort_order ?? 0}</span>
                    <span>{previewUrl ? '已上传试听' : '无试听文件'}</span>
                  </div>
                </div>
                <div className="text-right text-font-size-12 text-text-hint" style={{ fontFamily: FONT_REGULAR }}>
                  <div>更新时间</div>
                  <div className="mt-[4px] text-text-secondary">{formatTime(item.updated_at || item.updatedAt)}</div>
                </div>
              </div>

              <div className="mt-[12px] flex flex-wrap gap-[8px] text-font-size-12 text-text-secondary" style={{ fontFamily: FONT_REGULAR }}>
                {item.gender ? <span>性别：{item.gender}</span> : null}
                {item.age_group ? <span>年龄：{item.age_group}</span> : null}
                {item.language ? <span>语言：{item.language}</span> : null}
                {item.style ? <span>风格：{item.style}</span> : null}
                {item.emotions ? <span>情绪：{item.emotions}</span> : null}
              </div>

              <div className="mt-[16px] flex flex-wrap gap-[8px]">
                <ActionButton variant="secondary" onClick={() => onTogglePlay(item)} disabled={!previewUrl}>
                  {!previewUrl ? '暂无试听' : playingKey === rowPlayingKey ? '暂停试听' : '试听'}
                </ActionButton>
                <ActionButton variant="secondary" onClick={() => onEdit(item)}>
                  编辑音色
                </ActionButton>
                <ActionButton
                  variant="danger"
                  onClick={() => onDisable(item)}
                  disabled={deletingKey === item.id || !item.is_enabled}
                >
                  {deletingKey === item.id ? '停用中...' : item.is_enabled ? '停用音色' : '已停用'}
                </ActionButton>
              </div>
            </div>
          );
        })}
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
