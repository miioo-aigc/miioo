import { useEffect, useRef, useState } from 'react';
import { apiGetStoryboards } from '../../api/storyboard';
import { apiGetCompositions } from '../../api/compositions';
import { getErrorMessage } from '../../api/error';
import { Button } from '../ui/Button';
import DotsLoading from '../DotsLoading';
import EditDraftManager from './EditDraftManager';
import EditExportProgress from './EditExportProgress';
import { EpisodeSelector } from '../storyboard/StoryboardControls';
import { getEpisodeId } from '../storyboard/storyboardControlUtils';
import { createStoryboardDraft } from '../../api/CompositionDraftCreation';

export default function EditWorkspace({ projectId, projectName = '项目', episodes = [], showToast, onOpenEditor }) {
  const [episodeSelection, setEpisodeSelection] = useState(() => ({ projectId, id: new URLSearchParams(window.location.search).get('episode_id') }));
  const selectedEpisode = (episodeSelection?.projectId === projectId
    ? episodes.find((episode) => getEpisodeId(episode) === episodeSelection.id)
    : null) || episodes[0] || null;
  const episodeId = selectedEpisode?.id;
  const requestKey = projectId + ':' + (episodeId || '');
  const [result, setResult] = useState(null);
  const [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState(null);
  const creatingRef = useRef(false);
  const current = result?.key === requestKey ? result : null;
  const loading = Boolean(projectId) && !current;
  const storyboards = current?.storyboards || [];
  const drafts = current?.drafts || [];
  const error = current?.error;
  const totalDuration = storyboards.reduce((sum, storyboard) => {
    const duration = Number(storyboard.duration || storyboard.storyboard_video?.duration || 0);
    return sum + (Number.isFinite(duration) ? duration : 0);
  }, 0);

  useEffect(() => {
    const restoreEpisode = () => setEpisodeSelection({ projectId, id: new URLSearchParams(window.location.search).get('episode_id') });
    window.addEventListener('popstate', restoreEpisode);
    return () => window.removeEventListener('popstate', restoreEpisode);
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    Promise.all([
      episodeId ? apiGetCompositions(projectId, episodeId) : Promise.resolve([]),
      apiGetStoryboards(projectId, episodeId ? { episode_id: episodeId } : {}),
    ]).then(([compositions, data]) => {
      if (cancelled) return;
      setResult({ key: requestKey, drafts: compositions, storyboards: Array.isArray(data) ? data : (Array.isArray(data?.list) ? data.list : []) });
    }).catch((cause) => {
      if (!cancelled) setResult({ key: requestKey, error: getErrorMessage(cause, '加载剪辑数据失败') });
    });
    return () => { cancelled = true; };
  }, [projectId, episodeId, requestKey, retry]);

  function openEditor(compositionId) {
    if (!projectId) return;
    if (onOpenEditor) {
      onOpenEditor(compositionId, selectedEpisode);
      return;
    }
    const query = new URLSearchParams({ project_id: projectId });
    if (compositionId) query.set('comp_id', compositionId);
    if (episodeId) query.set('episode_id', episodeId);
    window.location.assign('/editor?' + query);
  }

  async function handleCreate() {
    if (!projectId || busy || creatingRef.current) return;
    creatingRef.current = true;
    setBusy('create');
    try {
      const { draft, skipped } = await createStoryboardDraft(projectId, episodeId, drafts.length);
      if (skipped) showToast?.(`${skipped} 个定稿视频缺少有效资产或时长，未自动加入轨道`, 'warning');
      setResult((previous) => previous?.key === requestKey
        ? { ...previous, drafts: [...previous.drafts, draft] }
        : previous);
      openEditor(draft.id);
    } catch (cause) {
      showToast?.(getErrorMessage(cause, '新建剪辑失败'), 'error');
    } finally {
      creatingRef.current = false;
      setBusy(null);
    }
  }

  return (
    <div className="absolute inset-0 flex min-h-0 flex-col gap-[12px] overflow-hidden" style={{ marginBottom: '24px', marginRight: '32px', boxSizing: 'border-box' }}>
      <section className="relative flex min-h-0 flex-1 flex-col gap-[12px] overflow-auto rounded-[16px] border border-stroke-normal bg-[#060606] px-[24px] py-[16px]">
        <header className="relative z-20 flex shrink-0 flex-wrap items-center justify-between gap-[12px]">
          <div className="flex flex-wrap items-center gap-[22px] text-font-size-14 leading-[20px]">
            <div className="flex items-center gap-[4px]">
              <span className="text-text-secondary">{projectName}</span>
              <span className="text-text-hint">›</span>
              <EpisodeSelector
                episodes={episodes}
                value={selectedEpisode}
                onChange={(episode) => {
                  const id = getEpisodeId(episode);
                  setEpisodeSelection({ projectId, id });
                  const url = new URL(window.location.href);
                  url.searchParams.set('episode_id', id);
                  window.history.replaceState({}, '', url.pathname + url.search);
                }}
              />
            </div>
            <span className="text-white/[0.8]">
              {loading ? '加载中…' : error ? '分镜数据加载失败' : '分镜数' + String(storyboards.length).padStart(2, '0') + '，时长' + Math.round(totalDuration) + '秒'}
            </span>
          </div>
          <EditExportProgress projectId={projectId} />
        </header>
        {loading ? (
          <div role="status" aria-label="正在加载剪辑草稿" className="flex flex-1 items-center justify-center"><DotsLoading /></div>
        ) : error ? (
          <div role="alert" className="flex flex-1 flex-col items-center justify-center gap-[12px] text-text-secondary">
            <span>{error}</span>
            <Button onClick={() => { setResult(null); setRetry((value) => value + 1); }}>重新加载</Button>
          </div>
        ) : !projectId ? (
          <div className="flex flex-1 items-center justify-center text-text-secondary">请先选择项目</div>
        ) : (
          <EditDraftManager key={requestKey} projectId={projectId} drafts={drafts} showToast={showToast}
            onChange={(update) => setResult((previous) => previous?.key === requestKey ? { ...previous, drafts: update(previous.drafts) } : previous)}
            onOpen={openEditor} onCreate={handleCreate} creating={busy === 'create'} disabled={Boolean(busy)} />
        )}
      </section>
    </div>
  );
}
