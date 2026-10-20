import { useRef, useState } from 'react';
import { ArrowLeft, ChevronRight, Upload, CopyPlus, Move, Download, Trash2, ListChecks, RefreshCw } from 'lucide-react';
import { Button, TextField } from '../ui';
import AssetPickerModal from '../AssetPickerModal';
import SeedanceAssetPreviewModal from './SeedanceAssetPreviewModal';
import { canvasAssetLibrary as api, canvasLibraryMockEnabled } from '../../api/CanvasAssetLibrary';
import { showGlobalToast } from '../../stores/toastStore';
import useCanvasAssetLibrary from './UseCanvasAssetLibrary';
import CanvasLibraryGrid from './CanvasLibraryGrid';
import CanvasLibraryReadError from './CanvasLibraryReadError';
import { canvasLibraryItemKey, canvasLibraryMedia, canvasLibraryDrop } from './CanvasLibraryItems';
import CanvasLibrarySourceDialog from './CanvasLibrarySourceDialog';
import { CanvasLibraryDialog, CanvasLibraryDestinationDialog, CanvasLibraryDeleteDialog } from './CanvasLibraryDialogs';

/** 画布资产业务编排：目录、批量操作、上传和操作弹窗；不双写真实画布。 */
export default function CanvasLibraryContents({ collection }) {
  const library = useCanvasAssetLibrary(collection);
  const { parentId, items, folder, loading, error, busy, navigate, refresh, run, loadMore, cursor } = library;
  const [batch, setBatch] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [allSelection, setAllSelection] = useState(null);
  const [nameDialog, setNameDialog] = useState(null);
  const [name, setName] = useState('');
  const [destination, setDestination] = useState(null);
  const [deletion, setDeletion] = useState(null);
  const [preview, setPreview] = useState(null);
  const [source, setSource] = useState(null);
  const input = useRef(null);
  const chosen = items.filter((item) => selected.has(canvasLibraryItemKey(item)));
  const mediaOnly = !allSelection && chosen.length > 0 && chosen.every((item) => item.type !== 'folder');
  const canMove = !allSelection && chosen.length > 0;
  const selection = (list) => list.map(({ type, id, revision, base_revision }) => ({ type, id, base_revision: base_revision ?? revision }));
  const clearSelection = () => { setSelected(new Set()); setAllSelection(null); };
  const go = (id) => { if (busy) return; setBatch(false); clearSelection(); navigate(id || collection.root_folder_id); };
  const toggle = (key) => { if (allSelection) return; setSelected((old) => { const next = new Set(old); if (next.has(key)) next.delete(key); else next.add(key); return next; }); };
  const selectAll = async (checked) => {
    clearSelection();
    if (!checked) return;
    const result = await run(() => api.selection({ collection_id: collection.id, parent_id: parentId, scope: 'directory_children' }), { reload: false });
    if (result) setAllSelection(result);
  };
  const rename = (item = null) => { setName(item?.name || item?.asset?.name || ''); setNameDialog({ item }); };
  const saveName = async () => {
    const item = nameDialog.item;
    const result = await run(() => item ? api.rename({ type: item.type, id: item.id, asset_id: item.asset_id, name: name.trim(), base_revision: item.type === 'folder' ? item.revision : item.asset?.revision }) : api.create({ parent_id: parentId, name: name.trim() }));
    if (result) { setNameDialog(null); clearSelection(); }
  };
  const move = async (list, target) => {
    if (list.some((item) => item.collection_id && item.collection_id !== collection.id)) {
      showGlobalToast('error', '跨集合不能移动，请通过添加素材创建引用'); return;
    }
    if (await run(() => api.move({ selection: selection(list), target_folder_id: target }))) { setDestination(null); clearSelection(); }
  };
  const requestDelete = async (list) => {
    const result = await run(() => api.preview(allSelection ? { selection_token: allSelection.selection_token } : { selection: selection(list) }), { reload: false });
    if (result) setDeletion(result);
    else clearSelection();
  };
  const confirmDelete = async () => {
    const result = await run(() => api.commit({ preview_token: deletion.preview_token }));
    // 失败也关闭旧预检，强制用户重新预检、重新确认，禁止复用过期范围。
    setDeletion(null);
    clearSelection();
    if (!result) refresh();
  };
  const addReferences = async (assetIds) => {
    const result = await run(() => api.references({ folder_id: parentId, asset_ids: [...new Set(assetIds)] }));
    if (result) { setSource(null); clearSelection(); }
    return Boolean(result);
  };
  const addExternal = async (assets) => {
    const ids = assets.map((asset) => asset.asset_id || asset.assetId);
    if (ids.some((id) => !id)) {
      showGlobalToast('error', '来源接口未提供统一资产编号，需后端完成资产身份映射后才能添加；不会通过下载重新上传代替引用');
      return false;
    }
    return addReferences(ids);
  };
  const upload = async (event) => {
    const files = [...event.target.files];
    event.target.value = '';
    if (!files.length) return;
    clearSelection();
    await run(async () => {
      let completed = 0;
      const failures = [];
      for (const file of files) {
        try { await api.upload(file, parentId); completed++; }
        catch (cause) { failures.push(`${file.name}：${cause.message}`); }
      }
      if (failures.length) showGlobalToast('error', `已上传 ${completed} 个，失败 ${failures.length} 个。${failures.join('；')}`);
      else showGlobalToast('success', `已上传 ${completed} 个素材`);
    });
  };
  const download = (list) => run(async () => {
    for (const item of list) {
      const result = await api.download(item);
      if (!result.url) throw new Error('下载地址暂不可用');
      const url = new URL(result.url, window.location.href);
      if (!['https:', 'http:', ...(canvasLibraryMockEnabled || result.revoke ? ['blob:'] : [])].includes(url.protocol)) throw new Error('下载地址无效');
      const link = document.createElement('a');
      link.href = url.href; link.download = result.name || item.asset?.name || '素材'; link.rel = 'noopener';
      document.body.append(link); link.click(); link.remove();
      if (result.revoke) setTimeout(() => URL.revokeObjectURL(result.url), 60000);
    }
  }, { reload: false });
  const path = [...(folder?.ancestors || []), ...(folder ? [folder] : [])].filter((item) => item.id !== collection.root_folder_id);
  return <section className="flex min-h-0 min-w-0 flex-1 flex-col text-text-primary">
    {parentId && <header className="flex flex-wrap items-center justify-between gap-[12px] px-[24px] py-[16px]">
      {parentId ? <nav aria-label="文件夹路径" className="flex min-w-0 flex-wrap items-center gap-[8px]">
        {parentId !== collection.root_folder_id && <Button iconOnly icon={<ArrowLeft size={16} />} aria-label="返回上一级" title="返回上一级" disabled={busy} onClick={() => go(folder?.parent_id)} />}
        <button disabled={busy} title={collection.name} onClick={() => go(collection.root_folder_id)} onDragOver={(event) => !busy && event.preventDefault()} onDrop={(event) => !busy && canvasLibraryDrop(event, move, collection.root_folder_id)} className="max-w-[200px] truncate text-[14px] text-text-secondary">{collection.name}</button>
        {path.map((item) => <span key={item.id} className="flex min-w-0 items-center gap-[8px]"><ChevronRight size={14} /><button title={item.name} disabled={busy} onClick={() => go(item.id)} onDragOver={(event) => !busy && event.preventDefault()} onDrop={(event) => !busy && canvasLibraryDrop(event, move, item.id)} className="max-w-[200px] truncate text-[14px]">{item.name}</button></span>)}
      </nav> : <div />}
      <div className="flex flex-wrap items-center gap-[8px]">
        <Button iconOnly icon={<RefreshCw size={16} />} title="刷新" aria-label="刷新" disabled={busy || loading} onClick={() => { clearSelection(); refresh(); }} />
        {parentId && <><Button variant="secondary" icon={<Upload size={16} />} disabled={busy || loading || Boolean(error)} onClick={() => input.current.click()}>上传素材</Button><Button variant="secondary" icon={<CopyPlus size={16} />} disabled={busy || loading || Boolean(error)} onClick={() => setSource('choose')}>添加素材</Button></>}
        <Button variant="secondary" icon={<ListChecks size={16} />} disabled={busy} onClick={() => { setBatch((old) => !old); clearSelection(); }}>{batch ? '退出批量' : '批量操作'}</Button>
      </div>
    </header>}
    {batch && <div className="flex flex-wrap items-center gap-[12px] px-[24px] pb-[16px]">
      <label className="flex items-center gap-[8px] text-[14px]"><input type="checkbox" disabled={busy || loading || Boolean(error)} checked={Boolean(allSelection)} onChange={(event) => selectAll(event.target.checked)} />全选</label><span className="text-[12px] text-text-secondary">已选 {allSelection?.count ?? chosen.length} 项</span>
      <Button iconOnly icon={<Move size={16} />} title={allSelection ? '请取消全选后勾选需要移动的条目' : '移动到'} aria-label="批量移动" disabled={busy || !canMove} onClick={() => setDestination({ list: chosen, mode: 'move' })} />
      <Button iconOnly icon={<CopyPlus size={16} />} title={mediaOnly ? '添加到文件夹' : '添加引用仅支持素材，请取消选择文件夹'} aria-label="批量添加引用" disabled={busy || !mediaOnly} onClick={() => setDestination({ list: chosen, mode: 'reference' })} />
      <Button iconOnly icon={<Download size={16} />} title={mediaOnly ? '下载' : '下载仅支持素材，请取消选择文件夹'} aria-label="批量下载" disabled={busy || !mediaOnly} onClick={() => download(chosen)} />
      <Button iconOnly icon={<Trash2 size={16} />} title="删除" aria-label="批量删除" disabled={busy || !(allSelection?.count ?? chosen.length)} onClick={() => requestDelete(chosen)} />
    </div>}
    <div className={`relative flex min-h-0 flex-1 flex-col overflow-auto px-[24px] pb-[24px] ${parentId ? '' : 'pt-[24px]'}`}>
      <CanvasLibraryGrid collectionId={collection.id} allSelected={Boolean(allSelection)} items={error ? [] : items} selected={allSelection ? new Set(items.map(canvasLibraryItemKey)) : selected} batch={batch} busy={busy || loading} onSelect={toggle} onCreate={() => rename()} onRename={rename} onOpen={(item) => item.type === 'folder' ? go(item.id) : setPreview(canvasLibraryMedia(item))} onDelete={requestDelete} onMove={move} onDestination={(list) => setDestination({ list, mode: 'move' })} onReference={(list) => setDestination({ list, mode: 'reference' })} onDownload={download} />
      {error && <CanvasLibraryReadError busy={busy} onRetry={() => { clearSelection(); refresh(); }} />}
      {loading && <p role="status" className="py-[24px] text-[14px] text-text-secondary">加载中...</p>}
      {cursor && <div className="pt-[24px] text-center"><Button variant="secondary" disabled={loading || busy} onClick={loadMore}>加载更多</Button></div>}
    </div>
    <input ref={input} type="file" multiple accept="image/*,video/*,audio/*" className="hidden" onChange={upload} />
    {nameDialog && <CanvasLibraryDialog title={nameDialog.item ? '重命名' : '新增文件夹'} busy={busy} onClose={() => setNameDialog(null)} footer={<><Button variant="secondary" disabled={busy} onClick={() => setNameDialog(null)}>取消</Button><Button disabled={busy || !name.trim()} loading={busy} onClick={saveName}>确认</Button></>}><TextField label="名称" autoFocus value={name} disabled={busy} onChange={(event) => setName(typeof event === 'string' ? event : event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.nativeEvent.isComposing && name.trim() && !busy) saveName(); }} /></CanvasLibraryDialog>}
    {destination && <CanvasLibraryDestinationDialog collection={collection} selection={destination.list} mode={destination.mode} busy={busy} onClose={() => setDestination(null)} onConfirm={async (target) => {
      if (destination.mode === 'move') return move(destination.list, target);
      if (await run(() => api.references({ folder_id: target, asset_ids: [...new Set(destination.list.map((item) => item.asset_id))] }))) { setDestination(null); clearSelection(); }
    }} />}
    {deletion && <CanvasLibraryDeleteDialog preview={deletion} busy={busy} onClose={() => setDeletion(null)} onConfirm={confirmDelete} />}
    {preview && <SeedanceAssetPreviewModal asset={preview} onClose={() => setPreview(null)} />}
    {source === 'choose' && <CanvasLibraryDialog title="添加素材" onClose={() => setSource(null)} footer={<Button variant="secondary" onClick={() => setSource(null)}>取消</Button>}><div className="flex flex-col gap-[12px]"><Button variant="secondary" onClick={() => setSource('canvas')}>画布资产</Button><Button variant="secondary" onClick={() => setSource('external')}>项目资产 / 创作资产 / seedance素材库</Button><Button variant="secondary" onClick={() => { setSource(null); input.current.click(); }}>本地上传</Button></div></CanvasLibraryDialog>}
    {source === 'canvas' && <CanvasLibrarySourceDialog busy={busy} onClose={() => setSource(null)} onConfirm={addReferences} />}
    {source === 'external' && <AssetPickerModal open includeSeedanceLibrary accept="all" onClose={() => setSource(null)} onConfirm={addExternal} assetFilter={(asset) => ['image', 'video', 'audio'].includes(asset.asset_type || asset.type)} />}
  </section>;
}
