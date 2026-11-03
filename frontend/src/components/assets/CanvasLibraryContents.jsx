import { useState } from 'react';
import { Button, TextField } from '../ui';
import CanvasLibraryDetail from './CanvasLibraryDetail';
import { canvasAssetLibrary as api, canvasLibraryMockEnabled } from '../../api/CanvasAssetLibrary';
import { showGlobalToast } from '../../stores/toastStore';
import useCanvasAssetLibrary from './UseCanvasAssetLibrary';
import AssetsBatchToolbar from './AssetsBatchToolbar';
import CanvasLibraryGrid from './CanvasLibraryGrid';
import CanvasLibraryReadError from './CanvasLibraryReadError';
import { canvasLibraryItemKey, canvasLibraryToggleSelection, canvasLibrarySelectLoaded, canvasLibraryDrop, canvasLibraryPath } from './CanvasLibraryItems';
import { CanvasLibraryDialog, CanvasLibraryDestinationDialog, CanvasLibraryDeleteDialog } from './CanvasLibraryDialogs';

// 2026-11-02：移动等待飞入动画，静默同步成功后提示文件移动成功。
// 2026-11-02：移除顶部刷新入口，路径使用斜杠分隔，上下内边距为 8px。
/** 画布资产业务编排：目录、批量操作和管理弹窗；不双写真实画布。 */
export default function CanvasLibraryContents({ collection }) {
  const library = useCanvasAssetLibrary(collection);
  const { parentId, items, folder, loading, error, busy, navigate, refresh, run, loadMore, cursor, syncAfterMove } = library;
  const [batch, setBatch] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [nameDialog, setNameDialog] = useState(null);
  const [name, setName] = useState('');
  const [destination, setDestination] = useState(null);
  const [deletion, setDeletion] = useState(null);
  const [preview, setPreview] = useState(null);
  const chosen = items.filter((item) => selected.has(canvasLibraryItemKey(item)));
  const mediaOnly = chosen.length > 0 && chosen.every((item) => item.type !== 'folder');
  const canMove = chosen.length > 0;
  const selection = (list) => list.map(({ type, id, revision, base_revision }) => ({ type, id, base_revision: base_revision ?? revision }));
  const allSelected = items.length > 0 && chosen.length === items.length;
  const clearSelection = () => setSelected(new Set());
  const go = (id) => { if (busy) return; setBatch(false); clearSelection(); navigate(id || collection.root_folder_id); };
  const toggle = (key) => { if (!busy && !loading) setSelected((old) => canvasLibraryToggleSelection(old, key)); };
  const selectAll = () => {
    if (busy || loading || error) return;
    setSelected(canvasLibrarySelectLoaded(items, !allSelected));
  };
  const rename = (item = null) => { setName(item?.name || item?.asset?.name || ''); setNameDialog({ item }); };
  const saveName = async () => {
    const item = nameDialog.item;
    const result = await run(() => item ? api.rename({ type: item.type, id: item.id, asset_id: item.asset_id, name: name.trim(), base_revision: item.type === 'folder' ? item.revision : item.asset?.revision }) : api.create({ parent_id: parentId, name: name.trim() }));
    if (result) { setNameDialog(null); clearSelection(); }
  };
  const move = async (list, target, animationFinished = Promise.resolve()) => {
    if (list.some((item) => item.collection_id && item.collection_id !== collection.id)) {
      showGlobalToast('error', '跨集合不能移动，请在所属项目内整理素材'); return;
    }
    return run(async () => {
      await api.move({ selection: selection(list), target_folder_id: target });
      await animationFinished;
      setDestination(null);
      clearSelection();
      const synced = await syncAfterMove(list, target);
      if (synced) showGlobalToast('success', '文件移动成功');
      return true;
    }, { reload: false });
  };
  const requestDelete = async (list) => {
    const result = await run(() => api.preview({ selection: selection(list) }), { reload: false });
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
  const path = canvasLibraryPath(folder, parentId, collection.root_folder_id);
  return <section className="flex min-h-0 min-w-0 flex-1 flex-col text-text-primary">
    {parentId && <header className="flex flex-wrap items-center justify-between gap-[12px] px-[24px] py-[8px]">
      {parentId ? <nav aria-label="文件夹路径" className="flex min-w-0 flex-wrap items-center gap-[8px]">
        <button disabled={busy} title={collection.name} onClick={() => go(collection.root_folder_id)} onDragOver={(event) => !busy && event.preventDefault()} onDrop={(event) => !busy && canvasLibraryDrop(event, move, collection.root_folder_id)} className="max-w-[200px] truncate text-[14px] text-text-secondary">{collection.name}</button>
        {path.map((item) => <span key={item.id} className="flex min-w-0 items-center gap-[8px]"><span aria-hidden="true" className="text-[14px] text-text-secondary">/</span><button title={item.name} disabled={busy} onClick={() => go(item.id)} onDragOver={(event) => !busy && event.preventDefault()} onDrop={(event) => !busy && canvasLibraryDrop(event, move, item.id)} className="max-w-[200px] truncate text-[14px]">{item.name}</button></span>)}
      </nav> : <div />}
      <AssetsBatchToolbar
        embedded batchMode={batch} selectedCount={chosen.length}
        disabled={busy} selectAllDisabled={loading || Boolean(error) || !items.length}
        allSelected={allSelected} moveDisabled={!canMove} downloadDisabled={!mediaOnly}
        deleteDisabled={!chosen.length}
        moveTitle="移动到"
        downloadTitle={mediaOnly ? '下载' : '下载仅支持素材，请取消勾选文件夹'}
        onEnterBatch={() => { setBatch(true); clearSelection(); }}
        onSelectAll={selectAll}
        onMove={() => setDestination({ list: chosen })}
        onDownload={() => download(chosen)} onDelete={() => requestDelete(chosen)}
        onCancel={() => { setBatch(false); clearSelection(); }}
      />
    </header>}
    <div className={`relative flex min-h-0 flex-1 flex-col overflow-auto px-[24px] pb-[24px] ${parentId ? '' : 'pt-[24px]'}`}>
      <CanvasLibraryGrid collectionId={collection.id} parentId={parentId} items={error ? [] : items} selected={selected} batch={batch} busy={busy || loading} onSelect={toggle} onCreate={() => rename()} onRename={rename} onOpen={(item) => item.type === 'folder' ? go(item.id) : setPreview(item)} onDelete={requestDelete} onMove={move} onDestination={(list) => setDestination({ list })} onDownload={download} />
      {error && <CanvasLibraryReadError busy={busy} onRetry={() => { clearSelection(); refresh(); }} />}
      {loading && <p role="status" className="py-[24px] text-[14px] text-text-secondary">加载中...</p>}
      {cursor && <div className="pt-[24px] text-center"><Button variant="secondary" disabled={loading || busy} onClick={loadMore}>加载更多</Button></div>}
    </div>
    {nameDialog && <CanvasLibraryDialog title={nameDialog.item ? '重命名' : '新增文件夹'} busy={busy} onClose={() => setNameDialog(null)} footer={<><Button variant="secondary" disabled={busy} onClick={() => setNameDialog(null)}>取消</Button><Button disabled={busy || !name.trim()} loading={busy} onClick={saveName}>确认</Button></>}><TextField label="名称" autoFocus value={name} disabled={busy} onChange={(event) => setName(typeof event === 'string' ? event : event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.nativeEvent.isComposing && name.trim() && !busy) saveName(); }} /></CanvasLibraryDialog>}
    {destination && <CanvasLibraryDestinationDialog collection={collection} sourceFolderId={parentId} selection={destination.list} busy={busy} onClose={() => setDestination(null)} onConfirm={(target) => move(destination.list, target)} />}
    {deletion && <CanvasLibraryDeleteDialog preview={deletion} busy={busy} onClose={() => setDeletion(null)} onConfirm={confirmDelete} />}
    {preview && <CanvasLibraryDetail key={canvasLibraryItemKey(preview)} entry={preview} onClose={() => { setPreview(null); refresh(); }} onDownload={() => download([preview])} onDelete={() => { setPreview(null); requestDelete([preview]); }} onChanged={refresh} />}
  </section>;
}
