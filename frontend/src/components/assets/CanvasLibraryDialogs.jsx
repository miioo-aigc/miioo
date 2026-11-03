import { useEffect, useRef, useState, useId } from 'react';
import { createPortal } from 'react-dom';
import { Folder, ChevronRight, ArrowLeft, FolderOpen } from 'lucide-react';
import { Button } from '../ui';
import Radio from '../ui/Radio';
import ModalCloseButton from '../ui/ModalCloseButton';
import useCanvasLibraryBrowser from './UseCanvasLibraryBrowser';

export function CanvasLibraryDialog({ title, busy, onClose, children, footer, fixedHeight = false }) {
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
      <section ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} onKeyDown={handleKey} onClick={(event) => event.stopPropagation()} style={fixedHeight ? { height: '520px' } : undefined} className="flex max-h-[85vh] w-[480px] max-w-full flex-col overflow-hidden rounded-[8px] border border-white/10 bg-surface-modal text-text-primary">
      <header className="flex shrink-0 items-center justify-between gap-[16px] p-[24px]"><h2 className="text-[16px]">{title}</h2><ModalCloseButton disabled={busy} onClick={onClose} /></header>
      <div className={`min-h-0 overflow-auto px-[24px] pb-[24px] text-[14px] ${fixedHeight ? 'flex flex-1 flex-col' : ''}`}>{children}</div>
      <footer className="flex shrink-0 flex-wrap justify-end gap-[8px] border-t border-white/10 p-[16px]">{footer}</footer>
    </section>
  </div>, document.body);
}

export function CanvasLibraryDestinationDialog({ collection, selection, sourceFolderId, busy, onClose, onConfirm }) {
  const browser = useCanvasLibraryBrowser(collection);
  const { path, page, loading, error } = browser;
  const [target, setTarget] = useState(null);
  const radioName = useId();
  const forbidden = new Set(selection.filter((item) => item.type === 'folder').map((item) => item.id));
  forbidden.add(sourceFolderId);
  const visibleFolders = page.items.filter((item) => item.type === 'folder' && !forbidden.has(item.id));
  const root = { id: collection.root_folder_id, name: '项目根目录' };
  const targetPath = (item) => item.id === root.id ? root.name : [...path.map((entry, index) => index === 0 ? root.name : entry.name), item.name].join(' / ');
  const renderRow = (item, isRoot = false) => {
    const disabled = busy || loading || Boolean(error) || forbidden.has(item.id);
    return <div key={item.id} className="flex items-center gap-[12px] rounded-[6px] px-[12px] py-[12px] hover:bg-white/5">
      <label className={`flex min-w-0 flex-1 items-center gap-[12px] ${disabled ? 'cursor-not-allowed opacity-30' : 'cursor-pointer'}`}>
        <Radio name={radioName} value={item.id} checked={target?.id === item.id} disabled={disabled} onChange={() => setTarget({ id: item.id, path: targetPath(item) })} />
        <Folder size={18} className="shrink-0" /><span className="truncate">{item.name}</span>
      </label>
      {(!isRoot || path.length > 1) && <button type="button" disabled={disabled} aria-label={isRoot ? '浏览项目根目录' : `进入${item.name}`} onClick={() => isRoot ? browser.root() : browser.enter(item)} className="flex h-[24px] w-[24px] shrink-0 items-center justify-center rounded-[6px] text-white-60 disabled:opacity-30"><ChevronRight size={16} /></button>}
    </div>;
  };
  return <CanvasLibraryDialog fixedHeight title="移动到" busy={busy} onClose={onClose} footer={<>
    <p title={target?.path} className="mr-auto min-w-0 flex-1 self-center truncate text-[12px] text-white-60">移动目标：{target?.path || '请选择目标文件夹'}</p>
    <Button variant="secondary" disabled={busy} onClick={onClose}>取消</Button>
    <Button loading={busy} disabled={busy || loading || Boolean(error) || !target || forbidden.has(target.id)} onClick={() => onConfirm(target.id)}>确认</Button>
  </>}>
    {path.length > 1 && <button type="button" aria-label="返回上一级" title="返回上一级" disabled={busy || loading} onClick={browser.back} className="mb-[12px] flex h-[24px] w-[24px] shrink-0 items-center justify-center self-start rounded-[6px] text-white-60 hover:text-white disabled:opacity-30"><ArrowLeft size={16} /></button>}
    <div role="group" aria-label="目标文件夹">
      {path.length === 1 && !forbidden.has(root.id) && renderRow(root, true)}
      {!loading && !error && visibleFolders.map((item) => renderRow(item))}
    </div>
    {loading && <p role="status">加载中...</p>}
    {error && <div role="alert">加载失败<Button variant="link" onClick={browser.retry}>重试</Button></div>}
    {!loading && !error && visibleFolders.length === 0 && !page.next_cursor && <div role="status" className="flex min-h-[100px] flex-1 flex-col items-center justify-center gap-[12px] text-text-secondary"><FolderOpen size={64} strokeWidth={1} className="text-white/20" aria-hidden="true" /><p>没有子文件夹</p></div>}
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
