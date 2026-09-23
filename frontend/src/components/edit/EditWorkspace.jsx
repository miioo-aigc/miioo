import { useEffect, useRef, useState } from 'react';
import { apiGetStoryboards, apiBatchDownloadStoryboardVideos } from '../../api/storyboard';
import { apiGetCompositions, apiCreateComposition, apiExportJianyingDraft } from '../../api/compositions';
import { downloadBlob, downloadResponse } from '../../api/download';
import { getErrorMessage } from '../../api/error';
import { Button } from '../ui/Button';
import DotsLoading from '../DotsLoading';
import EditMethodActions from './EditMethodActions';
import EditDraftManager from './EditDraftManager';
import { EpisodeSelector } from '../storyboard/StoryboardControls';
import { getEpisodeId } from '../storyboard/storyboardControlUtils';

export default function EditWorkspace({ projectId, projectName = '项目', episodes = [], showToast, onOpenEditor }) {
  const [episodeSelection, setEpisodeSelection] = useState(null);
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
    if (!projectId) return;
    let cancelled = false;
    Promise.all([
      apiGetCompositions(projectId),
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
    window.location.assign('/editor?' + query);
  }

  async function handleDownload(kind) {
    if (!projectId || busy || storyboards.length === 0) return;
    setBusy(kind);
    const storyboardIds = storyboards.map((storyboard) => storyboard.id).filter(Boolean);
    try {
      if (kind === 'export') {
        const response = await apiExportJianyingDraft(projectId, { storyboardIds, projectName });
        const { filename } = await downloadResponse(response, { mediaType: 'zip', contextLabel: '剪映工程包' });
        showToast?.('已导出 ' + (filename || '剪映工程包'), 'success');
      } else {
        const blob = await apiBatchDownloadStoryboardVideos(projectId, storyboardIds);
        await downloadBlob(blob, { mediaType: 'zip', contextLabel: '分镜视频' });
        showToast?.('已下载分镜视频', 'success');
      }
    } catch (cause) {
      showToast?.(getErrorMessage(cause, kind === 'export' ? '导出剪映工程包失败' : '批量下载分镜视频失败'), 'error');
    } finally {
      setBusy(null);
    }
  }

  async function handleCreate() {
    if (!projectId || busy || creatingRef.current) return;
    creatingRef.current = true;
    setBusy('create');
    try {
      const draft = await apiCreateComposition(projectId, {
        name: '草稿' + String(drafts.length + 1).padStart(2, '0'),
        resolution: '1080p',
        aspectRatio: '16:9',
      });
      if (!draft?.id) throw new Error('新建剪辑失败：未返回工程 ID');
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

  const actions = (
    <EditMethodActions stacked={drafts.length === 0} busy={busy} hasMaterials={storyboards.length > 0}
      onExport={() => handleDownload('export')} onDownload={() => handleDownload('download')} onOnlineEdit={handleCreate} />
  );

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
                onChange={(episode) => setEpisodeSelection({ projectId, id: getEpisodeId(episode) })}
              />
            </div>
            <span className="text-white/[0.8]">
              {loading ? '加载中…' : error ? '分镜数据加载失败' : '分镜数' + String(storyboards.length).padStart(2, '0') + '，时长' + Math.round(totalDuration) + '秒'}
            </span>
          </div>
          {!loading && !error && projectId && drafts.length > 0 && actions}
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
        ) : drafts.length > 0 ? (
          <EditDraftManager key={requestKey} projectId={projectId} drafts={drafts} showToast={showToast}
            onChange={(update) => setResult((previous) => previous?.key === requestKey ? { ...previous, drafts: update(previous.drafts) } : previous)}
            onOpen={openEditor} onCreate={handleCreate} creating={busy === 'create'} disabled={Boolean(busy)} />
        ) : (
          <div className="flex min-h-[180px] flex-1 items-center justify-center">{actions}</div>
        )}
      </section>
    </div>
  );
}
