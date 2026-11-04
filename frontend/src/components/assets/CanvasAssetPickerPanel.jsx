import { useEffect, useState } from 'react';
import { Select, Button } from '../ui';
import DotsLoading from '../DotsLoading';
import RemoteReadStatus from '../feedback/RemoteReadStatus';
import { apiReadCanvasLibraryProjects } from '../../api/CanvasLibraryProjects';
import { getAuthSessionGeneration } from '../../api/request';
import useCanvasAssetLibrary from './UseCanvasAssetLibrary';
import CanvasLibraryGrid from './CanvasLibraryGrid';
import { canvasLibraryItemKey, canvasLibraryPath } from './CanvasLibraryItems';
import { toCanvasPickerAsset, sortCanvasPickerProjects } from './CanvasPickerAssets';

function CanvasPickerContents({ collection, selected, onToggle, onAssetsLoaded, accepts, isDisabled, isPreSelected }) {
  const library = useCanvasAssetLibrary(collection);
  useEffect(() => {
    onAssetsLoaded(library.items.filter(item => item.type !== 'folder').map(toCanvasPickerAsset));
  }, [library.items, onAssetsLoaded]);
  const items = library.items.filter(item => item.type === 'folder' || accepts(toCanvasPickerAsset(item)));
  const checked = new Set(items.filter(item => item.type !== 'folder'
    && (selected.has(toCanvasPickerAsset(item).id) || isPreSelected(toCanvasPickerAsset(item)))).map(canvasLibraryItemKey));
  const path = canvasLibraryPath(library.folder, library.parentId, collection.root_folder_id);
  return <div className="flex min-h-0 flex-1 flex-col gap-[16px]">
    <nav aria-label="文件夹路径" className="flex flex-wrap items-center gap-[8px] text-[14px] text-text-secondary">
      <button onClick={() => library.navigate(collection.root_folder_id)}>{collection.name}</button>
      {path.map(folder => <span key={folder.id} className="flex items-center gap-[8px]"><span>/</span><button onClick={() => library.navigate(folder.id)}>{folder.name}</button></span>)}
    </nav>
    {library.error ? <RemoteReadStatus error={library.error} onRetry={library.refresh} /> : <>
      <CanvasLibraryGrid pickerMode batch collectionId={collection.id} parentId={library.parentId}
        items={items} selected={checked} busy={library.loading}
        isSelectionDisabled={item => isDisabled(toCanvasPickerAsset(item))}
        onOpen={item => library.navigate(item.id)}
        onSelect={key => { const item = items.find(item => canvasLibraryItemKey(item) === key); if (item) onToggle(toCanvasPickerAsset(item)); }} />
      {library.loading && <p role="status" className="text-[14px] text-text-secondary">正在加载画布资产…</p>}
      {!library.loading && !items.length && <p className="text-[14px] text-text-secondary">暂无可选素材</p>}
      {library.cursor && <Button variant="link" disabled={library.loading} onClick={library.loadMore}>加载更多</Button>}
    </>}
  </div>;
}

/** 弹窗只读入口：项目、画布联动；素材选择交回父弹窗统一管理。 */
export default function CanvasAssetPickerPanel(props) {
  const [state, setState] = useState({ items: [], loading: true, error: '' });
  const [projectId, setProjectId] = useState(null);
  const [canvasId, setCanvasId] = useState(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const session = getAuthSessionGeneration();
    const current = () => !controller.signal.aborted && session === getAuthSessionGeneration();
    apiReadCanvasLibraryProjects(current, controller.signal).then(items => {
      if (!current()) return;
      const sorted = sortCanvasPickerProjects(items);
      setState({ items: sorted, loading: false, error: '' });
      setProjectId(sorted[0]?.id || null);
      setCanvasId(sorted[0]?.canvases[0]?.id || null);
    }).catch(error => { if (current()) setState({ items: [], loading: false, error: error.message }); });
    return () => controller.abort();
  }, [retry]);
  const project = state.items.find(item => item.id === projectId);
  const collection = project?.canvases.find(item => item.id === canvasId);
  return <div className="flex min-h-0 flex-1 flex-col gap-[16px] pt-[4px]">
    <div className="flex flex-wrap items-center gap-[16px]">
      <Select value={projectId || ''} displayValue={project?.name || '选择项目'} loading={state.loading} hideTriggerBorder
        menuAriaLabel="选择项目" options={state.items.map(item => ({ value: item.id, label: item.name }))}
        onChange={id => { setProjectId(id); setCanvasId(state.items.find(item => item.id === id)?.canvases[0]?.id || null); }} />
      <Select value={canvasId || ''} displayValue={collection?.name || '暂无画布'} hideTriggerBorder
        menuAriaLabel="选择画布" options={(project?.canvases || []).map(item => ({ value: item.id, label: item.name }))} onChange={setCanvasId} />
    </div>
    {state.loading && (
      <div role="status" aria-label="正在加载画布项目" className="flex min-h-0 flex-1 items-center justify-center">
        <DotsLoading size={5} gap={4} color="var(--color-brand-main)" />
      </div>
    )}
    {state.error ? <RemoteReadStatus error={state.error} onRetry={() => { setState(previous => ({ ...previous, loading: true, error: '' })); setRetry(value => value + 1); }} />
      : collection ? <CanvasPickerContents key={collection.id} collection={collection} {...props} />
        : !state.loading && <p className="text-[14px] text-text-secondary">{project ? '该项目暂无画布' : '暂无画布项目'}</p>}
  </div>;
}
