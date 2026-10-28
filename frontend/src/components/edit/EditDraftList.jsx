import { CreateCard } from '../ui';
import EditDraftCard from './EditDraftCard';

function savedTimestamp(draft) {
  const timestamp = draft.updatedAt ? new Date(draft.updatedAt).getTime() : NaN;
  return Number.isFinite(timestamp) ? timestamp : null;
}

export default function EditDraftList({ drafts, onOpen, onCreate, creating, disabled, onRename, onCopy, onDelete }) {
  // 仅按保存时间排序；缺失或无效时间置后，同时间保持原顺序。
  const sortedDrafts = [...drafts].sort((a, b) => {
    const aTime = savedTimestamp(a);
    const bTime = savedTimestamp(b);
    if (aTime === null) return bTime === null ? 0 : 1;
    if (bTime === null) return -1;
    return bTime - aTime;
  });
  return (
    <div aria-label="剪辑草稿列表" className="grid content-start gap-[16px] overflow-auto pb-[8px]" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(clamp(240px, 16vw, 288px), 1fr))' }}>
      <CreateCard onClick={onCreate} disabled={disabled} busy={creating} label={creating ? '新建中…' : '新建草稿'} />
      {sortedDrafts.map((draft, index) => (
        <EditDraftCard key={draft.id} draft={draft} index={index} disabled={disabled} onOpen={onOpen} onRename={onRename} onCopy={onCopy} onDelete={onDelete} />
      ))}
    </div>
  );
}
