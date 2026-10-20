import { useState } from 'react';
import { ArrowLeft, Folder, ChevronRight } from 'lucide-react';
import { Button } from '../ui';
import useCanvasLibraryBrowser from './UseCanvasLibraryBrowser';
import { CanvasLibraryDialog } from './CanvasLibraryDialogs';

/** 本库来源选择：跨目录选择统一 asset_id，不通过媒体地址重建原件。 */
export default function CanvasLibrarySourceDialog({ busy, onClose, onConfirm }) {
  const browser = useCanvasLibraryBrowser();
  const { path, page, loading, error } = browser;
  const [chosen, setChosen] = useState(new Map());
  return <CanvasLibraryDialog title="从画布资产添加" busy={busy} onClose={onClose} footer={<>
    <Button variant="secondary" disabled={busy} onClick={onClose}>取消</Button>
    <Button disabled={busy || !chosen.size} loading={busy} onClick={() => onConfirm([...chosen.keys()])}>添加（{chosen.size}）</Button>
  </>}>
    <div className="mb-[12px] flex items-center gap-[8px]"><Button iconOnly icon={<ArrowLeft size={16} />} title="返回上一级" aria-label="返回上一级" disabled={!path.length || busy} onClick={browser.back} /><span className="truncate">{path.at(-1)?.name || '画布资产'}</span></div>
    {loading && <p role="status">加载中...</p>}
    {error && <div role="alert">加载失败<Button variant="link" onClick={browser.retry}>重试</Button></div>}
    {!loading && !error && !page.items.length && <p className="text-text-secondary">暂无素材</p>}
    {page.items.map((item) => ['folder', 'collection'].includes(item.type) ? <button key={item.id} disabled={busy} className="flex w-full items-center gap-[12px] py-[12px] text-left" onClick={() => browser.enter(item)}><Folder size={18} /><span className="min-w-0 flex-1 truncate">{item.name}</span><ChevronRight size={16} /></button> : <label key={item.id} className="flex items-center gap-[12px] py-[12px]"><input type="checkbox" disabled={busy || !item.asset_id} checked={chosen.has(item.asset_id)} onChange={() => setChosen((old) => { const next = new Map(old); if (next.has(item.asset_id)) next.delete(item.asset_id); else next.set(item.asset_id, item.asset?.name); return next; })} /><span className="truncate">{item.asset?.name || '未命名素材'}</span></label>)}
    {page.next_cursor && <Button disabled={busy || loading} onClick={browser.more}>加载更多</Button>}
  </CanvasLibraryDialog>;
}
