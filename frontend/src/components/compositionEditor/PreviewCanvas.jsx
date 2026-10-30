import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { computeVisualWindows, computeAudioWindows, computeSubtitleWindows, computeTotalDuration, useCompositionEditorStore } from '../../stores/compositionEditorStore';
import { useOriginalVideoSources } from './UseOriginalVideoSources';
import Select from '../ui/Select';
import VideoPlayerBar from '../ui/VideoPlayerBar';
import PreviewAudioLayer from './PreviewAudioLayer';
import SubtitlePreview from './SubtitlePreview';
import { PreviewMediaClock } from './PreviewMediaClock';
import CompositionVisualItem from './CompositionVisualItem';
import LoadingAnimation from '../LoadingAnimation';
import { pointInRect, transformRect, rectTransform, resizeRect, canvasRatio } from '../../utils/CompositionTransform';

const FONT = "'AlibabaPuHuiTi 2_55 Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif";

// 仅剪辑预览屏蔽回车激活播放，保留其他宿主的键盘行为。
function preventPlaybackEnter(event) {
  if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); }
}

export default function PreviewCanvas() {
  const [quality, setQuality] = useState('smooth');
  const [previewVolume, setPreviewVolume] = useState(1);
  const [previewMuted, setPreviewMuted] = useState(false);
  const outputVolume = previewMuted ? 0 : previewVolume;
  const seek = useCompositionEditorStore(s => s.seek);
  const [clock] = useState(() => new PreviewMediaClock());
  const seekEpoch = useCompositionEditorStore((s) => s.seekEpoch);
  const segments = useCompositionEditorStore((s) => s.segments);
  const originals = useOriginalVideoSources(segments, quality === 'original');
  const playing = useCompositionEditorStore((s) => s.playing);
  const cursor = useCompositionEditorStore((s) => s.cursor);
  const play = useCompositionEditorStore((s) => s.play);
  const pause = useCompositionEditorStore((s) => s.pause);
  const onCursorTick = useCompositionEditorStore((s) => s.onCursorTick);
  const trackSettings = useCompositionEditorStore((s) => s.trackSettings);
  const aspectRatio = useCompositionEditorStore((s) => s.aspectRatio);
  const editingVisualId = useCompositionEditorStore((s) => s.editingVisualId);
  const showVisualEditor = useCompositionEditorStore((s) => s.showVisualEditor);
  const selectedId = useCompositionEditorStore((s) => s.selectedId);
  const selectedIds = useCompositionEditorStore((s) => s.selectedIds);
  const select = useCompositionEditorStore((s) => s.select);
  const previewTransform = useCompositionEditorStore((s) => s.previewTransform);
  const commitTransform = useCompositionEditorStore((s) => s.commitTransform);
  const [mediaStatus, setMediaStatus] = useState({});
  const [audioErrors, setAudioErrors] = useState({});
  const onAudioError = useCallback((id, error) => setAudioErrors((state) => {
    if (state[id] === error || (!error && !(id in state))) return state;
    const next = { ...state };
    if (error) next[id] = error;
    else delete next[id];
    return next;
  }), []);
  const [imageRatios, setImageRatios] = useState({});
  const [drag, setDrag] = useState(null);
  const dragRef = useRef(null);
  useEffect(() => () => {
    const gesture = dragRef.current;
    if (gesture) commitTransform(gesture.snapshot, true);
  }, [commitTransform]);
  const readiness = useRef(false);
  const [clockWaiting, setClockWaiting] = useState(false);
  const viewportRef = useRef(null);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const ratio = canvasRatio(aspectRatio);
  const canvasWidth = Math.min(viewportSize.width, viewportSize.height * ratio);

  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => {
      setViewportSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(viewportRef.current);
    return () => observer.disconnect();
  }, []);

  const windows = useMemo(() => computeVisualWindows(segments).windows
    .filter((item) => !trackSettings[item.seg.track || 'V1']?.hidden)
    .sort((a, b) => Number((a.seg.track || 'V1').slice(1)) - Number((b.seg.track || 'V1').slice(1))), [segments, trackSettings]);
  const total = computeTotalDuration(segments);
  const activeSubtitles = computeSubtitleWindows(segments).windows.filter((item) => cursor >= item.start && cursor < item.end && !trackSettings[item.seg.track || 'S1']?.hidden)
    .sort((a, b) => Number((b.seg.track || 'S1').slice(1)) - Number((a.seg.track || 'S1').slice(1)));
  const activeWindows = useMemo(() => windows.filter((item) => cursor >= item.start && cursor < item.end), [windows, cursor]);

  // A1 音轨窗口与 cursor 所在的活跃音频段（含分离自视频的音频段）
  const allAudioWindows = useMemo(() => computeAudioWindows(segments).windows, [segments]);
  const audioTracks = [...new Set(allAudioWindows.map((item) => item.seg.track || 'A1'))];
  const onVideoStatus = useCallback((id, value) => setMediaStatus((state) => {
    if (!value) { if (!(id in state)) return state; const next = { ...state }; delete next[id]; return next; }
    if (state[id]?.status === value.status && state[id]?.data === value.data && state[id]?.error === value.error && state[id]?.playable === value.playable) return state;
    return { ...state, [id]: value };
  }), []);
  const onImageStatus = useCallback((id, value) => setImageRatios((state) => {
    if (state[id]?.status === value.status && state[id]?.ratio === value.ratio) return state;
    return { ...state, [id]: value };
  }), []);
  const topSelected = selectedIds.length <= 1 ? activeWindows.find((item) => item.seg.id === selectedId) : null;
  const activeVideoStatuses = activeWindows.filter((item) => item.seg.type === 'video')
    .map((item) => mediaStatus[item.seg.id]).filter(Boolean);
  const pending = activeWindows.some((item) => item.seg.type === 'video' && !mediaStatus[item.seg.id]?.playable && mediaStatus[item.seg.id]?.status !== 'failed');
  const failed = activeVideoStatuses.find((item) => item.status === 'failed');
  const imageFailed = activeWindows.some((item) => item.seg.type === 'image' && imageRatios[item.seg.id]?.status === 'failed');
  const audioError = allAudioWindows.find((item) => cursor >= item.start && cursor < item.end && audioErrors[item.seg.id]);
  const audioErrorMessage = audioError ? audioErrors[audioError.seg.id] : null;
  useEffect(() => { if (failed || imageFailed || audioErrorMessage) pause(); }, [failed, imageFailed, audioErrorMessage, playing, pause]);
  const allReady = activeWindows.every((item) => item.seg.type === 'video' ? mediaStatus[item.seg.id]?.playable === true : imageRatios[item.seg.id]?.status === 'ready');
  useEffect(() => {
    readiness.current = allReady;
    clock.setBlocked(!allReady);
    clock.require([
      ...activeWindows.filter((item) => item.seg.type === 'video').map((item) => 'video-' + item.seg.id),
      ...allAudioWindows.filter((item) => cursor >= item.start && cursor < item.end).map((item) => item.seg.track || 'A1'),
    ]);
  }, [allReady, clock, activeWindows, allAudioWindows, cursor]);
  const resumeAfterWait = !allReady;

  const selectedRatio = topSelected ? (topSelected.seg.type === 'image'
    ? imageRatios[topSelected.seg.id]?.ratio
    : (mediaStatus[topSelected.seg.id]?.data?.source?.display_aspect_ratio?.num / mediaStatus[topSelected.seg.id]?.data?.source?.display_aspect_ratio?.den)) : null;
  const canvasHeight = canvasWidth / ratio;
  const editing = Boolean(topSelected && editingVisualId === topSelected.seg.id && selectedRatio && !playing && !trackSettings[topSelected.seg.track || 'V1']?.locked);
  const fittedView = { scale: 1, left: (viewportSize.width - canvasWidth) / 2, top: (viewportSize.height - canvasHeight) / 2 };
  const view = drag?.view || fittedView;
  const activeRect = (item) => {
    const sourceRatio = item.seg.type === 'image' ? imageRatios[item.seg.id]?.ratio
      : (() => { const source = mediaStatus[item.seg.id]?.data?.source?.display_aspect_ratio; return source?.num / source?.den; })();
    if (!sourceRatio) return null;
    const rect = transformRect(item.seg.visualTransform || { mode: 'legacy_contain' }, sourceRatio, canvasWidth, canvasHeight);
    // 视觉轨道按编号递增向上覆盖：V2 高于 V1，V3 高于 V2。
    const trackNumber = Number.parseInt(String(item.seg.track || 'V1').slice(1), 10) || 1;
    return rect ? { ...rect, x: rect.x * view.scale, y: rect.y * view.scale, width: rect.width * view.scale, height: rect.height * view.scale, zIndex: 100 + trackNumber } : null;
  };
  const selectedRect = topSelected ? activeRect(topSelected) : null;
  const beginTransform = (event, handle) => {
    if (event.button !== 0 || !topSelected || !selectedRect || trackSettings[topSelected.seg.track || 'V1']?.locked) return;
    event.preventDefault(); event.stopPropagation();
    const rect = transformRect(topSelected.seg.visualTransform || { mode: 'legacy_contain' }, selectedRatio, canvasWidth, canvasHeight);
    const before = useCompositionEditorStore.getState();
    const snapshot = { segments: before.segments, aspectRatio: before.aspectRatio, selectedId: before.selectedId, selectedIds: before.selectedIds, album: before.album, libraryAssetIds: before.libraryAssetIds, trackSettings: before.trackSettings, mainTracks: before.mainTracks };
    const gesture = { id: topSelected.seg.id, view, pointerId: event.pointerId, handle, x: event.clientX, y: event.clientY, rect, snapshot };
    dragRef.current = gesture;
    setDrag(gesture);
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const moveTransform = (event) => {
    const drag = dragRef.current;
    if (!drag || event.pointerId !== drag.pointerId) return;
    const next = resizeRect(drag.rect, drag.handle, (event.clientX - drag.x) / drag.view.scale, (event.clientY - drag.y) / drag.view.scale);
    previewTransform(drag.id, rectTransform(next, canvasWidth, canvasHeight));
  };
  const endTransform = (cancel = false) => { const gesture = dragRef.current; if (gesture) { dragRef.current = null; commitTransform(gesture.snapshot, cancel); setDrag(null); } };
  const handleCanvasClick = (event) => {
    if (event.target.closest('button')) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / view.scale;
    const y = (event.clientY - bounds.top) / view.scale;
    if (!pointInRect(x, y, { x: 0, y: 0, width: canvasWidth, height: canvasHeight })) return;
    pause();
    for (let i = activeWindows.length - 1; i >= 0; i -= 1) {
      const item = activeWindows[i];
      if (!trackSettings[item.seg.track || 'V1']?.hidden && !trackSettings[item.seg.track || 'V1']?.locked && pointInRect(x, y, transformRect(item.seg.visualTransform || { mode: 'legacy_contain' }, item.seg.type === 'image' ? imageRatios[item.seg.id]?.ratio : (() => { const r = mediaStatus[item.seg.id]?.data?.source?.display_aspect_ratio; return r?.num / r?.den; })(), canvasWidth, canvasHeight))) { select(item.seg.id); showVisualEditor(); return; }
    }
  };

  // Stop at every media boundary so the next frame uses the newly registered segment.
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let lastTs = performance.now();
    const tick = () => {
      const now = performance.now();
      const dt = (now - lastTs) / 1000;
      lastTs = now;
      // 逐帧增量基于 store 最新 cursor，播放中 seek 后自动自校正
      const cursorNow = useCompositionEditorStore.getState().cursor;
      const boundaries = [...windows, ...allAudioWindows].flatMap((window) => [window.start, window.end]);
      const boundary = Math.min(total, ...boundaries.filter((time) => time > cursorNow + 1e-6));
      clock.setBlocked(!readiness.current);
      const next = clock.tick(cursorNow, dt, now, boundary);
      setClockWaiting(clock.blocked);
      if (next >= total - 1e-6) {
        onCursorTick(total);
        pause();
        return;
      }
      onCursorTick(next);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, total, onCursorTick, pause, clock, windows, allAudioWindows, seekEpoch]);

  const togglePlay = () => {
    if (total <= 0) return;
    if (playing) pause();
    else play();
  };


  return (
    <div className="flex-1 flex flex-col overflow-hidden min-h-0 bg-surface-content-area">
      <div ref={viewportRef} className="relative min-h-0 min-w-0 flex-1 overflow-hidden bg-surface-content-area mx-[16px]">
        <div aria-label={`成片画布 ${aspectRatio}`} onClick={handleCanvasClick} className="absolute overflow-visible bg-black" style={{ left: view.left, top: view.top, width: canvasWidth * view.scale, height: canvasHeight * view.scale }}>
        <div className="absolute inset-0" style={{ clipPath: editing && selectedRect ? `inset(${Math.min(0, selectedRect.y)}px ${Math.min(0, canvasWidth * view.scale - selectedRect.x - selectedRect.width)}px ${Math.min(0, canvasHeight * view.scale - selectedRect.y - selectedRect.height)}px ${Math.min(0, selectedRect.x)}px)` : 'inset(0)' }}>
          {!activeWindows.length ? (
            <span className="text-text-hint text-font-size-14" style={{ fontFamily: FONT, visibility: segments.length ? 'hidden' : 'visible' }}>
              从左侧添加素材开始剪辑
            </span>
          ) : null}
          {activeWindows.map((item) => <CompositionVisualItem key={item.seg.id + quality} window={item} quality={quality} original={originals.sources[item.seg.assetId]} refreshOriginal={originals.refresh}
            clipBounds={editing && topSelected?.seg.id === item.seg.id ? null : { width: canvasWidth * view.scale, height: canvasHeight * view.scale }}
            rect={activeRect(item)} playing={playing} clock={clock} seekEpoch={seekEpoch}
            settings={trackSettings[item.seg.track || 'V1']} outputVolume={outputVolume}
            onStatus={onVideoStatus} onImageStatus={onImageStatus} />)}
        </div>
        {editing && selectedRect && <>
          {/* 将画布外暗化限制在素材真实外框内，外围空白背景保持原色。 */}
          <div className="pointer-events-none absolute overflow-hidden" style={{ zIndex: 90, left: selectedRect.x, top: selectedRect.y, width: selectedRect.width, height: selectedRect.height }}>
            <div style={{ position: 'absolute', left: -selectedRect.x, top: -selectedRect.y, width: canvasWidth * view.scale, height: canvasHeight * view.scale, boxShadow: '0 0 0 100000px rgba(0,0,0,0.75)' }} />
          </div>
          <div className="pointer-events-none absolute inset-0" style={{ zIndex: 90, outline: '1px solid var(--color-stroke-accent)' }} />
        </>}
        {editing && selectedRect && <div onClick={(event) => event.stopPropagation()} onPointerMove={moveTransform} onPointerUp={() => endTransform()} onPointerCancel={() => endTransform(true)} onLostPointerCapture={() => endTransform(true)} style={{ position: 'absolute', left: selectedRect.x, top: selectedRect.y, width: selectedRect.width, height: selectedRect.height, border: '1px solid #2DC3E1', zIndex: 100, touchAction: 'none', cursor: drag ? 'grabbing' : 'move' }} onPointerDown={(event) => beginTransform(event, 'move')}>
          {['nw','n','ne','e','se','s','sw','w'].map((handle) => <span key={handle} onPointerDown={(event) => beginTransform(event, handle)} style={{ position: 'absolute', width: handle.length === 2 ? 10 : (handle === 'n' || handle === 's' ? 24 : 5), height: handle.length === 2 ? 10 : (handle === 'e' || handle === 'w' ? 24 : 5), left: handle.includes('w') ? 0 : handle.includes('e') ? '100%' : '50%', top: handle.includes('n') ? 0 : handle.includes('s') ? '100%' : '50%', transform: 'translate(-50%, -50%)', borderRadius: 2, background: '#2DC3E1', cursor: handle.length === 2 ? handle + '-resize' : handle + '-resize' }} />)}
        </div>}
        {(pending || (playing && clockWaiting)) && !failed && !audioErrorMessage && <div role="status" aria-label="预览视频加载中" style={{ position: 'absolute', inset: 0, zIndex: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', background: '#0008' }}><LoadingAnimation width={180} /><span className="sr-only">{resumeAfterWait ? '正在缓冲，加载完成后继续播放' : '正在加载预览视频'}</span></div>}
        {failed && <button type="button" onClick={() => failed.retry()} style={{ position: 'absolute', zIndex: 121, left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}>预览视频暂不可用，点击重试</button>}
        {audioErrorMessage && <span role="alert" className="absolute inset-0 flex items-center justify-center text-text-secondary text-font-size-14 pointer-events-none z-[120]">{audioErrorMessage}</span>}
        {imageFailed && <span role="status" className="absolute inset-0 flex items-center justify-center text-text-secondary text-font-size-14 pointer-events-none z-[120]">图片加载失败，请重新添加素材</span>}
        <SubtitlePreview cues={activeSubtitles} />
        </div>
      </div>

      <VideoPlayerBar playing={playing} currentTime={cursor} duration={total} disabled={total <= 0}
        trailingControl={<Select width="120px" value={quality} displayValue={quality === 'original' ? '画质优先' : '流畅优先'}
          options={[{ value: 'smooth', label: '流畅优先' }, { value: 'original', label: '画质优先' }]} menuPlacement="up"
          onChange={value => { if (value === quality) return; clock.setBlocked(true); readiness.current = false; setMediaStatus({}); originals.reset(); setQuality(value); }} />}
        onToggle={togglePlay} onToggleKeyDown={preventPlaybackEnter} onSeek={seek} volume={previewVolume} muted={previewMuted}
        onVolumeChange={setPreviewVolume} onMutedChange={setPreviewMuted}
        />
      {audioTracks.map((track) => <PreviewAudioLayer key={track} track={track} clock={clock} seekEpoch={seekEpoch}
        active={allAudioWindows.find((item) => (item.seg.track || 'A1') === track && cursor >= item.start && cursor < item.end)}
        playing={playing} settings={trackSettings[track]} outputVolume={outputVolume} onError={onAudioError} />)}
    </div>
  );
}
