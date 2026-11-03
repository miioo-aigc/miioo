import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight, ChevronDown, MoreVertical, Pencil, Copy, Download, Trash2 } from 'lucide-react';
import { Button } from '../ui';
import DropdownMenu from '../ui/DropdownMenu';

export default function CanvasCollectionSidebar({ library, busy, onAction }) {
  const [menu, setMenu] = useState(null);
  const [expanded, setExpanded] = useState({});
  const [selectedCanvases, setSelectedCanvases] = useState({});
  const selectCanvas = (projectId, canvasId) => {
    setMenu(null);
    setSelectedCanvases(old => ({ ...old, [projectId]: canvasId }));
    if (canvasId !== library.collectionId) library.selectCanvas(canvasId);
  };
  const toggleProject = (item, open) => {
    setMenu(null);
    // 固定已展开项目，避免切换选中项时隐式收起。
    setExpanded(old => ({
      ...Object.fromEntries(library.items.map(project => [
        project.id, old[project.id] ?? (project.id === library.selectedId),
      ])),
      [item.id]: !open,
    }));
    const currentCanvas = item.canvases.find(canvas => canvas.id === library.collectionId);
    if (open) {
      if (currentCanvas) setSelectedCanvases(old => ({ ...old, [item.id]: currentCanvas.id }));
      return;
    }
    const canvas = currentCanvas
      || item.canvases.find(canvas => canvas.id === selectedCanvases[item.id])
      || item.canvases[0];
    if (canvas) selectCanvas(item.id, canvas.id);
  };
  useEffect(() => {
    const close = () => setMenu(null);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => { window.removeEventListener('resize', close); window.removeEventListener('scroll', close, true); };
  }, []);
  const actions = [['rename', '重命名项目', Pencil], ['copy', '复制项目', Copy], ['download', '下载项目资产', Download], ['delete', '删除项目', Trash2]];
  return <aside className="flex min-h-0 w-[220px] shrink-0 flex-col gap-[4px] overflow-y-auto border-r border-white/10 px-[12px] py-[16px]">
    {library.items.map((item) => { const open = expanded[item.id] ?? (item.id === library.selectedId); const selected = item.id === library.selectedId && !open; const Chevron = open ? ChevronDown : ChevronRight; return <div key={item.id}><div className={`group flex shrink-0 items-center gap-[8px] rounded-[8px] px-[12px] py-[10px] ${selected ? 'bg-white/[0.06]' : 'hover:bg-white/[0.03]'}`}>
      <button disabled={busy} title={item.name} aria-expanded={open} aria-pressed={selected} className={`min-w-0 flex-1 truncate text-left text-[14px] ${selected ? 'text-text-primary' : 'text-text-secondary'}`} onClick={() => toggleProject(item, open)}><Chevron size={16} className="mr-[6px] inline-block" />{item.name}</button>
      {onAction && <button disabled={busy} aria-label={`${item.name}的更多操作`} title="更多操作" className="flex h-[24px] w-[24px] shrink-0 items-center justify-center rounded-[6px] text-text-secondary opacity-0 hover:bg-white/10 focus:opacity-100 group-hover:opacity-100" onClick={(event) => { const rect = event.currentTarget.getBoundingClientRect(); setMenu({ item, top: Math.max(8, Math.min(rect.bottom + 4, window.innerHeight - 164)), left: Math.max(8, Math.min(rect.right - 160, window.innerWidth - 168)) }); }}><MoreVertical size={16} /></button>}
    </div>{open && <div className="ml-[20px] flex flex-col border-l border-white/10 pl-[8px]">{item.canvases.map(canvas => <button key={canvas.id} disabled={busy} title={canvas.name} aria-pressed={canvas.id === library.collectionId} className="truncate rounded-[6px] px-[10px] py-[8px] text-left text-[14px] text-text-secondary hover:bg-white/[0.03] aria-pressed:bg-white/[0.06] aria-pressed:text-text-primary" onClick={() => selectCanvas(item.id, canvas.id)}>{canvas.name}</button>)}{!item.canvases.length && <span className="px-[10px] py-[8px] text-[12px] text-text-secondary">暂无画布</span>}</div>}</div>; })}
    {library.cursor && !library.error && <Button variant="link" disabled={busy || library.loading} onClick={library.more}>加载更多</Button>}
    {menu && createPortal(<DropdownMenu width="160px" style={{ position: 'fixed', top: menu.top, left: menu.left, bottom: 'auto', right: 'auto', zIndex: 2200 }} onClose={() => setMenu(null)} items={actions.map(([key, label, Icon]) => ({ key, label, icon: <Icon size={16} />, danger: key === 'delete', disabled: busy, onClick: () => { setMenu(null); onAction(key, menu.item); } }))} />, document.body)}
  </aside>;
}
