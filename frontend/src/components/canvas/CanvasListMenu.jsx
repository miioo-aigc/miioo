import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Plus, Ellipsis, Pencil, Copy, Trash2 } from 'lucide-react';
import { DropdownMenu, IconButton, TextField, Tooltip } from '../ui';
import ConfirmDialog from '../ConfirmDialog';

export default function CanvasListMenu({ canvases, activeCanvasId, busy, onSelectCanvas, onCreateCanvas, onRenameCanvas, onDuplicateCanvas, onDeleteCanvas }) {
  const [more, setMore] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState('');
  const submitting = useRef(false);
  const submit = async () => {
    if (submitting.current || busy || !name.trim()) return;
    submitting.current = true;
    try {
      if (await onRenameCanvas(editing, name)) setEditing(null);
    } finally { submitting.current = false; }
  };
  return <div className="absolute bottom-[40px] left-1/2 z-30 w-[176px] -translate-x-1/2 rounded-[8px] border border-stroke-normal bg-surface-card p-[4px]" style={{ boxShadow: '0 4px 16px var(--color-shadow)' }} onKeyDown={(event) => {
    event.stopPropagation();
    if (event.key === 'Escape' && !busy) { event.preventDefault(); setEditing(null); setMore(null); setDeleting(null); }
  }}>
    <div className="max-h-[280px] overflow-y-auto" onScroll={() => setMore(null)}>
      {canvases.map((canvas) => <div key={canvas.id} className={`group/canvas-item flex h-[36px] items-center gap-[4px] rounded-[6px] px-[6px] ${canvas.id === activeCanvasId ? 'bg-white-10' : 'hover:bg-white-5'}`}>
        {editing === canvas.id ? <TextField autoFocus aria-label="画布名称" value={name} disabled={busy}
          wrapperClassName="min-w-0 flex-1" wrapperStyle={{ height: 28, padding: '0 4px' }}
          onChange={(event) => setName(event.target.value.slice(0, 100))}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.nativeEvent.isComposing && event.keyCode !== 229) { event.preventDefault(); void submit(); }
          }} /> : <button type="button" disabled={busy} onClick={() => onSelectCanvas(canvas.id)} title={canvas.name}
          className="min-w-0 flex-1 truncate border-0 bg-transparent py-[6px] text-left text-[13px] text-text-secondary hover:text-text-primary disabled:cursor-wait">{canvas.name || '未命名画布'}</button>}
        <Tooltip label={editing === canvas.id ? '保存名称' : '更多选项'}>
          <span className={`shrink-0 ${editing === canvas.id || more?.canvas.id === canvas.id ? '' : 'invisible group-hover/canvas-item:visible group-focus-within/canvas-item:visible'}`}><IconButton aria-label={editing === canvas.id ? '保存名称' : `${canvas.name}更多选项`} aria-haspopup={editing === canvas.id ? undefined : 'menu'} aria-expanded={more?.canvas.id === canvas.id} variant="link" className="!size-[24px]" disabled={busy || (editing === canvas.id && !name.trim())}
            contentClassName="!text-text-secondary group-hover:!text-text-primary group-active:!text-text-secondary"
            onClick={(event) => {
              if (editing === canvas.id) { void submit(); return; }
              const rect = event.currentTarget.getBoundingClientRect();
              setMore(more?.canvas.id === canvas.id ? null : { canvas,
                left: Math.max(8, rect.right + 168 <= window.innerWidth ? rect.right + 4 : rect.left - 164),
                top: Math.max(8, Math.min(rect.top, window.innerHeight - 120)),
              });
            }}>
            {editing === canvas.id ? <Check size={14} /> : <Ellipsis size={16} />}
          </IconButton></span>
        </Tooltip>
      </div>)}
    </div>
    <div className="my-[4px] h-px bg-stroke-normal" />
    <button type="button" disabled={busy} onClick={onCreateCanvas} className="flex h-[32px] w-full items-center gap-[4px] rounded-[6px] border-0 bg-transparent px-[10px] text-[13px] text-text-secondary hover:bg-white-5 hover:text-text-primary disabled:cursor-wait"><Plus size={14} />新增画布</button>
    {more && createPortal(<div onPointerDown={(event) => event.stopPropagation()} onMouseDown={(event) => event.stopPropagation()}>
      <DropdownMenu width={160} onClose={() => setMore(null)} style={{ position: 'fixed', left: more.left, top: more.top, bottom: 'auto', right: 'auto', zIndex: 110 }} items={[
        { key: 'rename', label: '重命名', icon: <Pencil size={16} />, disabled: busy, onClick: () => { setEditing(more.canvas.id); setName(more.canvas.name || ''); } },
        { key: 'copy', label: '复制', icon: <Copy size={16} />, disabled: busy, onClick: () => onDuplicateCanvas(more.canvas.id) },
        { key: 'delete', label: '删除', icon: <Trash2 size={16} />, danger: true, disabled: busy || canvases.length <= 1, onClick: () => setDeleting(more.canvas) },
      ]} />
    </div>, document.body)}
    {deleting && <div onPointerDown={(event) => event.stopPropagation()} onMouseDown={(event) => event.stopPropagation()}><ConfirmDialog title="删除画布？" description={`确认删除“${deleting.name}”？此操作仅归档该画布，不删除项目或素材。`}
      confirmText={busy ? '删除中…' : '删除'} onCancel={() => { if (!busy) setDeleting(null); }}
      onConfirm={async () => { if (!busy && await onDeleteCanvas(deleting.id)) setDeleting(null); }} /></div>}
  </div>;
}
