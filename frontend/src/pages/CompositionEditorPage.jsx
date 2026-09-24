import { useCallback, useEffect, useState } from 'react';
import { apiGetCompositions } from '../api/compositions';
import { getErrorMessage } from '../api/error';
import { normalizeImageUrl } from '../utils/imageUrl';
import { resolveFinalizedStoryboardAssets, getFinalizedStoryboardMedia, getMissingCompositionAssets, selectFinalizedStoryboardAssets } from '../utils/FinalizedStoryboardAssets';
import { useCompositionEditorStore } from '../stores/compositionEditorStore';
import EditorHeader from '../components/compositionEditor/EditorHeader';
import AssetLibraryPanel from '../components/compositionEditor/AssetLibraryPanel';
import PreviewCanvas from '../components/compositionEditor/PreviewCanvas';
import TimelineBar from '../components/compositionEditor/TimelineBar';
import PropsPanel from '../components/compositionEditor/PropsPanel';
import ExportModal from '../components/compositionEditor/ExportModal';
import WorkspaceHeader from '../components/compositionEditor/WorkspaceHeader';
import ResizableWorkspace from '../components/compositionEditor/ResizableWorkspace';
import { Button } from '../components/ui';

const FONT = "'AlibabaPuHuiTi 2_55 Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif";

/**
 * 把后端资产原始项归一化为剪辑台所需的视图模型。
 * 说明：assets.js 的 normalizeAsset 未对外导出，且项目资产分页接口对主体类素材
 * 返回的是「聚合卡片」（缺 asset_type / duration），无法满足剪辑台按独立素材上时间线
 * 的需求，故在此按统一口径做一次轻量归一化，回退顺序固定、可复查。
 */
function toEditorAsset(item) {
  const meta = item.metadata_json || {};
  const assetType = item.asset_type || item.type || '';
  const isVideo = assetType === 'video';
  const thumbnail = normalizeImageUrl(item.thumbnail_url || meta.thumbnail_url) || null;
  const fileUrl = normalizeImageUrl(item.file_url) || null;
  const rawDuration = meta.duration ?? item.duration;
  return {
    id: item.id,
    type: assetType,
    asset_type: assetType,
    name: item.name || '',
    // prompt 仅供素材面板关键词搜索（与后端搜索口径 name OR prompt 对齐）
    prompt: item.prompt || '',
    // url 仅承接缩略图，杜绝把视频地址塞进 <img>
    url: thumbnail,
    fileUrl,
    videoUrl: isVideo ? fileUrl : null,
    previewUrl: null,
    downloadUrl: normalizeImageUrl(item.download_url || item.file_url) || null,
    posterUrl: isVideo ? (normalizeImageUrl(item.poster_url || item.posterUrl || meta.poster_url) || thumbnail) : null,
    thumbnailUrl: thumbnail,
    duration: rawDuration && Number(rawDuration) > 0 ? Number(rawDuration) : null,
    ratio: item.ratio || meta.ratio || '',
    resolution: item.resolution || meta.resolution || '',
    category: item.category || '',
    shot_number: meta.shot_number ?? null,
    storyboard_id: meta.storyboard_id ?? null,
    episode_number: meta.episode_number ?? null,
    is_primary: item.is_primary ?? false,
    scope: item.scope || 'personal',
    createdAt: item.created_at || '',
  };
}

export default function CompositionEditorPage({ embedded = false, projectId: suppliedProjectId, compId: suppliedCompId, projectName, episodes = [], initialEpisode, onBack, showToast } = {}) {
  const [query] = useState(() => new URLSearchParams(window.location.search));
  const projectId = suppliedProjectId || query.get('project_id');
  const compId = suppliedCompId || query.get('comp_id') || undefined;
  const [episode, setEpisode] = useState(initialEpisode || episodes[0] || null);
  const [initialized, setInitialized] = useState(false);
  const [loadError, setLoadError] = useState(null);

  const init = useCompositionEditorStore((s) => s.init);
  const loadAlbum = useCompositionEditorStore((s) => s.loadAlbum);
  const isLoaded = useCompositionEditorStore((s) => s.loaded);
  const exportState = useCompositionEditorStore((s) => s.exportState);

  const [album, setAlbum] = useState({ assets: [], finalized: [], loading: false, error: null });

  const fetchAlbum = useCallback(async (isCancelled = () => false) => {
    if (!projectId) return;
    setAlbum({ assets: [], finalized: [], loading: true, error: null });
    try {
      const finalized = await getFinalizedStoryboardMedia(projectId);
      const { assets, unavailable } = await resolveFinalizedStoryboardAssets(projectId, finalized);
      const list = [...new Map(assets.map((asset) => [String(asset.id), toEditorAsset(asset)])).values()];
      if (!isCancelled()) setAlbum({ assets: list, finalized, loading: false, error: null, warning: unavailable ? `${unavailable} 个定稿素材缺少可用资产关联或媒体地址，暂不可添加；其他素材可正常使用。` : null });
      return list;
    } catch (err) {
      if (!isCancelled()) setAlbum((prev) => ({ ...prev, loading: false, error: getErrorMessage(err, '素材库加载失败') }));
      return [];
    }
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    (async () => {
      try {
        const [assets, compositions] = await Promise.all([fetchAlbum(() => cancelled), apiGetCompositions(projectId)]);
        if (cancelled) return;
        const composition = compId ? compositions.find((item) => String(item.id) === String(compId)) : compositions[0];
        if (compId && !composition) throw new Error('草稿加载失败或已被删除，请返回列表重试');
        const missingAssets = await getMissingCompositionAssets(composition?.timeline, assets);
        if (cancelled) return;
        const restoredAssets = missingAssets.map(toEditorAsset);
        const allAssets = [...new Map([...assets, ...restoredAssets].map((asset) => [String(asset.id), asset])).values()];
        loadAlbum(allAssets);
        setAlbum((previous) => ({
          ...previous,
          assets: allAssets,
          loading: false,
        }));
        useCompositionEditorStore.setState({ compositionId: null, segments: [], playing: false, dirty: false });
        await init({ projectId, compId, compositions, isCancelled: () => cancelled });
        if (!cancelled) {
          const loadedId = useCompositionEditorStore.getState().compositionId;
          if (!loadedId || (compId && String(loadedId) !== String(compId))) {
            setLoadError('草稿加载失败或已被删除，请返回列表重试');
          } else {
            setInitialized(true);
          }
        }
      } catch (err) {
        if (!cancelled) setLoadError(getErrorMessage(err, '草稿加载失败，请返回列表重试'));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, compId, init, fetchAlbum, loadAlbum]);

  if (!projectId) {
    return (
      <div className="bg-neutral-400 h-[100vh] w-screen overflow-clip flex items-center justify-center">
        <div className="bg-surface-card border border-stroke-normal rounded-large px-[32px] py-[32px] flex flex-col items-center gap-[16px]">
          <span className="text-text-primary text-font-size-16 font-font-weight-medium" style={{ fontFamily: FONT }}>
            未指定项目，无法进入剪辑工作台
          </span>
          <button
            type="button"
            onClick={() => window.location.assign('/project')}
            className="flex items-center h-9 shrink-0 rounded-medium px-[16px] gap-[4px] bg-btn-primary-bg-normal hover:bg-btn-primary-bg-hover active:bg-btn-primary-bg-active border border-btn-primary-border cursor-pointer"
          >
            <span className="text-btn-primary-text text-font-size-14 font-font-weight-regular" style={{ fontFamily: FONT }}>
              返回项目
            </span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={embedded ? 'absolute inset-0 flex min-h-0 flex-col overflow-hidden' : 'bg-neutral-400 h-[100vh] w-screen overflow-clip flex flex-col [font-synthesis:none] antialiased'}
      style={{ fontFamily: FONT, ...(embedded ? { marginBottom: '24px', marginRight: '32px' } : {}) }}
    >
      <section
        className={embedded ? 'flex min-h-0 flex-1 flex-col gap-[12px] overflow-hidden rounded-[12px] border border-stroke-normal bg-[#060606] px-[24px] py-[16px]' : 'flex min-h-0 flex-1 flex-col'}
        style={embedded ? { borderRadius: '12px' } : undefined}
      >
      {embedded ? <WorkspaceHeader projectName={projectName} episodes={episodes} episode={episode} onEpisodeChange={setEpisode} onBack={onBack} showToast={showToast} ready={initialized && isLoaded} /> : <EditorHeader />}

      {loadError ? (
        <div role="alert" className="flex flex-1 flex-col items-center justify-center gap-[12px] text-text-secondary">
          <span>{loadError}</span>
          <Button className="cursor-pointer" onClick={onBack || (() => window.location.assign('/project'))}>返回草稿列表</Button>
        </div>
      ) : !initialized || !isLoaded ? (
        <div className="flex-1 flex items-center justify-center">
          <span className="text-text-hint text-font-size-14">正在加载工程…</span>
        </div>
      ) : (
        <ResizableWorkspace
          assets={<AssetLibraryPanel projectId={projectId} albumState={{ ...album, assets: selectFinalizedStoryboardAssets(album.assets, album.finalized, episode?.id) }} onFetch={() => fetchAlbum()} onAssetAdded={(items) => { loadAlbum([...new Map([...useCompositionEditorStore.getState().album, ...items].map((asset) => [asset.id, asset])).values()]); setAlbum((previous) => { const added = new Map(items.map((asset) => [String(asset.id), asset])); return { ...previous, assets: [...added.values(), ...previous.assets.filter((asset) => !added.has(String(asset.id)))] }; }); }} onRemoveAsset={(asset) => { loadAlbum(useCompositionEditorStore.getState().album.filter((item) => String(item.id) !== String(asset.id))); setAlbum((previous) => ({ ...previous, assets: previous.assets.filter((item) => String(item.id) !== String(asset.id)) })); }} />}
          preview={<PreviewCanvas />}
          properties={<PropsPanel />}
          timeline={<TimelineBar />}
        />
      )}
      </section>
      {exportState.status !== 'idle' && <ExportModal />}
    </div>
  );
}
