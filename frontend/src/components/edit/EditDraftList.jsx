import EditDraftCard from './EditDraftCard';

export default function EditDraftList({ drafts, onOpen, onCreate, creating, disabled, onRename, onCopy, onDelete }) {
  return (
    <div aria-label="剪辑草稿列表" className="grid content-start gap-[16px] overflow-auto pb-[8px]" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(clamp(240px, 16vw, 288px), 1fr))' }}>
      {drafts.map((draft, index) => (
        <EditDraftCard key={draft.id} draft={draft} index={index} disabled={disabled} onOpen={onOpen} onRename={onRename} onCopy={onCopy} onDelete={onDelete} />
      ))}
      <button type="button" onClick={onCreate} disabled={disabled} aria-busy={creating || undefined} className="flex aspect-[3/2] w-full min-w-0 cursor-pointer flex-col items-center justify-center gap-[6px] rounded-[8px] border border-dashed border-white/[0.15] bg-neutral-200 text-text-disabled hover:border-stroke-accent hover:text-text-secondary focus-visible:outline focus-visible:outline-[2px] focus-visible:outline-brand-main disabled:cursor-not-allowed">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M10 4V16M4 10H16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
        <span className="text-[14px] leading-[18px]">{creating ? '新建中…' : '新建草稿'}</span>
      </button>
    </div>
  );
}
