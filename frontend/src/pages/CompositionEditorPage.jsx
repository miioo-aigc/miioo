import { useCallback, useEffect, useState } from 'react';
import { apiGetAssetsPage } from '../api/assets';
import { getErrorMessage } from '../api/error';
import { normalizeImageUrl } from '../utils/imageUrl';
import { useCompositionEditorStore } from '../stores/compositionEditorStore';
import EditorHeader from '../components/compositionEditor/EditorHeader';
import AssetLibraryPanel from '../components/compositionEditor/AssetLibraryPanel';
import PreviewCanvas from '../components/compositionEditor/PreviewCanvas';
import TimelineBar from '../components/compositionEditor/TimelineBar';
import PropsPanel from '../components/compositionEditor/PropsPanel';
import ExportModal from '../components/compositionEditor/ExportModal';
import WorkspaceHeader from '../components/compositionEditor/WorkspaceHeader';
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

  const [album, setAlbum] = useState({ assets: [], loading: false, error: null });

  const fetchAlbum = useCallback(async () => {
    if (!projectId) return;
    setAlbum({ assets: [], loading: true, error: null });
    try {
      // 全量分页拉取项目资产（每页 200，上限 50 页），保证搜索池覆盖项目内全部数字资产
      const PAGE_LIMIT = 200;
      const MAX_PAGES = 50;
      const seen = new Set();
      const rawList = [];
      let pageCursor;
      for (let page = 0; page < MAX_PAGES; page += 1) {
        const result = await apiGetAssetsPage({
          project_id: projectId,
          include_deleted: false,
          scope: 'project',
          limit: PAGE_LIMIT,
          ...(pageCursor ? { cursor: pageCursor } : {}),
        });
        (result.list || []).forEach((item) => {
          if (item && item.id && !seen.has(item.id)) {
            seen.add(item.id);
            rawList.push(item);
          }
        });
        if (!result.hasMore || !result.nextCursor) break;
        pageCursor = result.nextCursor;
      }
      const list = rawList.map(toEditorAsset);
      setAlbum({ assets: list, loading: false, error: null });
      loadAlbum(list);
    } catch (err) {
      setAlbum((prev) => ({ ...prev, loading: false, error: getErrorMessage(err, '素材库加载失败') }));
    }
  }, [projectId, loadAlbum]);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    (async () => {
      await new Promise((resolve) => {
        // 先拉素材，保证 init 反查时间线 clip_id 时 album 已就绪
        fetchAlbum().finally(resolve);
      });
      if (!cancelled) {
        useCompositionEditorStore.setState({ compositionId: null, segments: [], playing: false, dirty: false });
        await init({ projectId, compId });
        if (!cancelled) {
          const loadedId = useCompositionEditorStore.getState().compositionId;
          if (!loadedId || (compId && String(loadedId) !== String(compId))) {
            setLoadError('草稿加载失败或已被删除，请返回列表重试');
          } else {
            setInitialized(true);
          }
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, compId, init, fetchAlbum]);

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
      <section className={embedded ? 'flex min-h-0 flex-1 flex-col gap-[12px] overflow-auto rounded-[16px] border border-stroke-normal bg-[#060606] px-[24px] py-[16px]' : 'flex min-h-0 flex-1 flex-col'}>
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
        <>
        <div className="flex min-h-[240px] flex-1 gap-[12px] overflow-hidden">
          <AssetLibraryPanel albumState={album} onFetch={fetchAlbum} episodeNumber={episode?.episode_number} />
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-neutral-200">
            <PreviewCanvas />
          </div>
          <PropsPanel />
        </div>
        <TimelineBar />
        </>
      )}
      </section>
      {exportState.status !== 'idle' && <ExportModal />}
    </div>
  );
}
