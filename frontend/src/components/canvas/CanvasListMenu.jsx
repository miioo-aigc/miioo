import { useRef, useState } from 'react';
import { Check, Plus } from 'lucide-react';
import { IconButton, TextField, Tooltip } from '../ui';

export default function CanvasListMenu({ canvases, activeCanvasId, busy, onSelectCanvas, onCreateCanvas, onRenameCanvas }) {
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
    if (event.key === 'Escape' && !busy) { event.preventDefault(); setEditing(null); }
  }}>
    <div className="max-h-[280px] overflow-y-auto">
      {canvases.map((canvas) => <div key={canvas.id} className={`group/canvas-item flex h-[36px] items-center gap-[4px] rounded-[6px] px-[6px] ${canvas.id === activeCanvasId ? 'bg-white-10' : 'hover:bg-white-5'}`}>
        {editing === canvas.id ? <TextField autoFocus aria-label="画布名称" value={name} disabled={busy}
          wrapperClassName="min-w-0 flex-1" wrapperStyle={{ height: 28, padding: '0 4px' }}
          onChange={(event) => setName(event.target.value.slice(0, 100))}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.nativeEvent.isComposing && event.keyCode !== 229) { event.preventDefault(); void submit(); }
          }} /> : <button type="button" disabled={busy} onClick={() => onSelectCanvas(canvas.id)} title={canvas.name}
          className="min-w-0 flex-1 truncate border-0 bg-transparent py-[6px] text-left text-[13px] text-text-secondary hover:text-text-primary disabled:cursor-wait">{canvas.name || '未命名画布'}</button>}
        <Tooltip label={editing === canvas.id ? '保存名称' : '编辑名称'}>
          <span className={`shrink-0 ${editing === canvas.id ? '' : 'invisible group-hover/canvas-item:visible'}`}><IconButton aria-label={editing === canvas.id ? '保存名称' : `编辑${canvas.name}名称`} variant="link" className="!size-[24px]" disabled={busy || (editing === canvas.id && !name.trim())}
            contentClassName="!text-text-secondary group-hover:!text-text-primary group-active:!text-text-secondary"
            onClick={() => { if (editing === canvas.id) void submit(); else { setEditing(canvas.id); setName(canvas.name || ''); } }}>
            {editing === canvas.id ? <Check size={14} /> : <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M2.33337 14H14.3334" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M3.66663 8.90663V11.3333H6.10569L13 4.43603L10.565 2L3.66663 8.90663Z" stroke="currentColor" strokeLinejoin="round" />
            </svg>}
          </IconButton></span>
        </Tooltip>
      </div>)}
    </div>
    <div className="my-[4px] h-px bg-stroke-normal" />
    <button type="button" disabled={busy} onClick={onCreateCanvas} className="flex h-[32px] w-full items-center gap-[4px] rounded-[6px] border-0 bg-transparent px-[10px] text-[13px] text-text-secondary hover:bg-white-5 hover:text-text-primary disabled:cursor-wait"><Plus size={14} />新增画布</button>
  </div>;
}
