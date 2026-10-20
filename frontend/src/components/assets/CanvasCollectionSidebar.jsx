import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { MoreVertical, Pencil, Copy, Download, Trash2 } from 'lucide-react';
import { Button } from '../ui';
import DropdownMenu from '../ui/DropdownMenu';

export default function CanvasCollectionSidebar({ library, busy, onAction }) {
  const [menu, setMenu] = useState(null);
  useEffect(() => {
    const close = () => setMenu(null);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => { window.removeEventListener('resize', close); window.removeEventListener('scroll', close, true); };
  }, []);
  const actions = [['rename', '重命名', Pencil], ['copy', '复制', Copy], ['download', '下载', Download], ['delete', '删除', Trash2]];
  return <aside className="flex min-h-0 w-[220px] shrink-0 flex-col gap-[4px] overflow-y-auto border-r border-white/10 px-[12px] py-[16px]">
    <div className="flex items-center px-[8px] pb-[8px] pt-[4px] text-[14px] text-text-secondary">项目列表</div>
    {library.items.map((item) => <div key={item.id} className={`group flex shrink-0 items-center gap-[8px] rounded-[8px] px-[12px] py-[10px] ${item.id === library.selectedId ? 'bg-white/[0.06]' : 'hover:bg-white/[0.03]'}`}>
      <button disabled={busy} title={item.name} aria-current={item.id === library.selectedId ? 'true' : undefined} className={`min-w-0 flex-1 truncate text-left text-[14px] ${item.id === library.selectedId ? 'text-text-primary' : 'text-text-secondary'}`} onClick={() => { setMenu(null); library.select(item.id); }}>{item.name}</button>
      <button disabled={busy} aria-label={`${item.name}的更多操作`} title="更多操作" className="flex h-[24px] w-[24px] shrink-0 items-center justify-center rounded-[6px] text-text-secondary opacity-0 hover:bg-white/10 focus:opacity-100 group-hover:opacity-100" onClick={(event) => { const rect = event.currentTarget.getBoundingClientRect(); setMenu({ item, top: Math.max(8, Math.min(rect.bottom + 4, window.innerHeight - 164)), left: Math.max(8, Math.min(rect.right - 160, window.innerWidth - 168)) }); }}><MoreVertical size={16} /></button>
    </div>)}
    {library.loading && <p role="status" className="px-[8px] py-[12px] text-[12px] text-text-secondary">加载中...</p>}
    {library.cursor && !library.error && <Button variant="link" disabled={busy || library.loading} onClick={library.more}>加载更多</Button>}
    {menu && createPortal(<DropdownMenu width="160px" style={{ position: 'fixed', top: menu.top, left: menu.left, bottom: 'auto', right: 'auto', zIndex: 2200 }} onClose={() => setMenu(null)} items={actions.map(([key, label, Icon]) => ({ key, label, icon: <Icon size={16} />, danger: key === 'delete', disabled: busy, onClick: () => onAction(key, menu.item) }))} />, document.body)}
  </aside>;
}
