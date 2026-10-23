import { ActionButton, StatusPill } from './adminShared';
import { formatDateTime } from './adminSharedUtils';

export default function AnnouncementList({ items, busy, onEdit, onPublish, onToggle, onDelete }) {
  return <div className="flex flex-col gap-[12px]">{items.map((item) => (
    <div key={item.id} className="border border-stroke-normal rounded-medium bg-neutral-200 p-[18px]">
      <div className="flex flex-wrap justify-between gap-[12px]">
        <div className="min-w-0 flex-1">
          <div className="break-words text-font-size-16 text-text-primary">{item.title}</div>
          <div className="mt-[4px] text-font-size-12 text-text-hint">{item.publishedAt ? `发布于 ${formatDateTime(item.publishedAt)}` : '草稿'} · {item.popupEnabled ? '弹窗提醒开启' : '无弹窗'}</div>
        </div>
        <StatusPill enabled={item.isActive && Boolean(item.publishedAt)} enabledLabel="已发布" disabledLabel={!item.isActive ? '已停用' : '草稿'} />
      </div>
      <p className="my-[12px] break-words whitespace-pre-wrap text-font-size-14 text-text-secondary">{item.content.slice(0, 220)}{item.content.length > 220 ? '...' : ''}</p>
      <div className="flex flex-wrap gap-[8px]">
        <ActionButton variant="secondary" disabled={busy} onClick={() => onEdit(item)}>编辑</ActionButton>
        {!item.publishedAt && <ActionButton variant="secondary" disabled={busy} onClick={() => onPublish(item)}>发布</ActionButton>}
        <ActionButton variant="secondary" disabled={busy} onClick={() => onToggle(item)}>{item.isActive ? '停用' : '启用'}</ActionButton>
        <ActionButton variant="danger" disabled={busy} onClick={() => onDelete(item)}>删除</ActionButton>
      </div>
    </div>
  ))}</div>;
}
