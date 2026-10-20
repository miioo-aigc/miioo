import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Folder, ChevronRight, ArrowLeft, X } from 'lucide-react';
import { Button } from '../ui';
import useCanvasLibraryBrowser from './UseCanvasLibraryBrowser';

export function CanvasLibraryDialog({ title, busy, onClose, children, footer }) {
  const ref = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    ref.current?.focus();
    return () => previous?.focus();
  }, []);
  const handleKey = (event) => {
    if (event.key === 'Escape' && !busy) onClose();
    if (event.key !== 'Tab') return;
    const controls = Array.from(ref.current.querySelectorAll('button:not(:disabled),input:not(:disabled),[tabindex="0"]'));
    const first = controls[0];
    const last = controls.at(-1);
    if (!first) { event.preventDefault(); return; }
    if (event.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };
  return createPortal(<div className="fixed inset-0 z-[2100] flex items-center justify-center bg-black/60 p-[16px] backdrop-blur-[12px]" onClick={() => !busy && onClose()}>
      <section ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} onKeyDown={handleKey} onClick={(event) => event.stopPropagation()} className="flex max-h-[85vh] w-[480px] max-w-full flex-col overflow-hidden rounded-[8px] border border-white/10 bg-surface-modal text-text-primary">
      <header className="flex items-center justify-between gap-[16px] p-[24px]"><h2 className="text-[16px]">{title}</h2><Button iconOnly icon={<X size={16} />} title="关闭" aria-label="关闭" disabled={busy} onClick={onClose} /></header>
      <div className="overflow-auto px-[24px] pb-[24px] text-[14px]">{children}</div>
      <footer className="flex flex-wrap justify-end gap-[8px] border-t border-white/10 p-[16px]">{footer}</footer>
    </section>
  </div>, document.body);
}

export function CanvasLibraryDestinationDialog({ collection, selection, mode = 'move', busy, onClose, onConfirm }) {
  const browser = useCanvasLibraryBrowser(mode === 'move' ? collection : null);
  const { path, page, loading, error, parentId } = browser;
  const forbidden = new Set(selection.filter((item) => item.type === 'folder').map((item) => item.id));
  return <CanvasLibraryDialog title={mode === 'move' ? '移动到' : '添加到文件夹'} busy={busy} onClose={onClose} footer={<>
    <Button variant="secondary" disabled={busy} onClick={onClose}>取消</Button>
    <Button loading={busy} disabled={loading || Boolean(error) || !parentId || forbidden.has(parentId)} onClick={() => onConfirm(parentId)}>确认</Button>
  </>}>
    <div className="mb-[12px] flex items-center gap-[8px]"><Button iconOnly aria-label="返回上一级" title="返回上一级" icon={<ArrowLeft size={16} />} disabled={path.length <= (mode === 'move' ? 1 : 0) || busy} onClick={browser.back} /><span className="truncate">{path.at(-1)?.name || '画布资产'}</span></div>
    {loading && <p role="status">加载中...</p>}
    {error && <div role="alert">加载失败<Button variant="link" onClick={browser.retry}>重试</Button></div>}
    {!loading && !error && !page.items.some((item) => ['folder', 'collection'].includes(item.type)) && <p className="text-text-secondary">没有子文件夹</p>}
    {page.items.filter((item) => ['folder', 'collection'].includes(item.type)).map((item) => <button key={item.id} disabled={busy || forbidden.has(item.id)} onClick={() => browser.enter(item)} className="flex w-full items-center gap-[12px] border-b border-white/10 py-[12px] text-left disabled:opacity-30"><Folder size={18} /><span className="min-w-0 flex-1 truncate">{item.name}</span><ChevronRight size={16} /></button>)}
    {page.next_cursor && <Button disabled={busy || loading} onClick={browser.more}>加载更多</Button>}
  </CanvasLibraryDialog>;
}

export function CanvasLibraryDeleteDialog({ preview, collection, busy, onClose, onConfirm }) {
  const impact = preview.impact;
  return <CanvasLibraryDialog title="确认删除" busy={busy} onClose={onClose} footer={<>
    <Button variant="secondary" disabled={busy} onClick={onClose}>取消</Button><Button variant="danger" loading={busy} onClick={onConfirm}>确认删除</Button>
  </>}>
    {collection && <p className="mb-[12px]">删除资产集合不会删除对应的画布项目。</p>}
    <p>将删除 {impact.folder_count} 个文件夹、{impact.native_asset_count} 个原生素材，并移除 {impact.reference_only_count} 条引用收录。</p>
    {impact.native_asset_count > 0 && <p className="mt-[12px] text-text-danger">原生素材的所有收录及画布引用将失效。节点与连线保留，只清空媒体内容。</p>}
    {impact.reference_only_count > 0 && <p className="mt-[12px] text-text-secondary">仅移除引用收录时，不删除外部原件，也不清空画布节点的内容。</p>}
    <p className="mt-[12px] text-text-secondary">影响 {impact.affected_project_count} 个项目、{impact.affected_canvas_count} 个画布、{impact.affected_node_count} 个节点。此操作没有前端恢复入口。</p>
    {preview.affected_projects?.length > 0 && <p className="mt-[12px] break-words">涉及项目：{preview.affected_projects.map((item) => item.name).join('、')}{preview.next_projects_cursor ? '等' : ''}</p>}
  </CanvasLibraryDialog>;
}
