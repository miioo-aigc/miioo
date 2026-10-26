import { useEffect, useMemo, useRef, useState } from 'react';
import { computeVisualWindows, computeAudioWindows, computeSubtitleWindows, computeTotalDuration, useCompositionEditorStore } from '../../stores/compositionEditorStore';
import PlaybackControls from './PlaybackControls';
import PreviewAudioLayer from './PreviewAudioLayer';
import SubtitlePreview from './SubtitlePreview';
import { PreviewMediaClock } from './PreviewMediaClock';

const FONT = "'AlibabaPuHuiTi 2_55 Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif";

function activeIndexFor(windows, cursor, total) {
  if (!windows.length) return -1;
  for (let i = 0; i < windows.length; i += 1) {
    if (cursor >= windows[i].start && cursor < windows[i].end) return i;
  }
  if (total > 0 && cursor >= total) return windows.length - 1;
  return -1;
}

export default function PreviewCanvas() {
  const [clock] = useState(() => new PreviewMediaClock());
  const seekEpoch = useCompositionEditorStore((s) => s.seekEpoch);
  const segments = useCompositionEditorStore((s) => s.segments);
  const playing = useCompositionEditorStore((s) => s.playing);
  const cursor = useCompositionEditorStore((s) => s.cursor);
  const play = useCompositionEditorStore((s) => s.play);
  const pause = useCompositionEditorStore((s) => s.pause);
  const seek = useCompositionEditorStore((s) => s.seek);
  const onCursorTick = useCompositionEditorStore((s) => s.onCursorTick);
  const trackSettings = useCompositionEditorStore((s) => s.trackSettings);
  const aspectRatio = useCompositionEditorStore((s) => s.aspectRatio);
  const viewportRef = useRef(null);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const ratio = aspectRatio === '9:16' ? 9 / 16 : aspectRatio === '1:1' ? 1 : 16 / 9;
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
    .sort((a, b) => Number((b.seg.track || 'V1').slice(1)) - Number((a.seg.track || 'V1').slice(1))), [segments, trackSettings]);
  const total = computeTotalDuration(segments);
  const activeSubtitles = computeSubtitleWindows(segments).windows.filter((item) => cursor >= item.start && cursor < item.end && !trackSettings[item.seg.track || 'S1']?.hidden)
    .sort((a, b) => Number((b.seg.track || 'S1').slice(1)) - Number((a.seg.track || 'S1').slice(1)));
  const activeIndex = activeIndexFor(windows, cursor, total);
  const active = activeIndex >= 0 ? windows[activeIndex] : null;
  const v1Settings = trackSettings[active?.seg.track || 'V1'] || { hidden: false, volume: 1 };

  // A1 音轨窗口与 cursor 所在的活跃音频段（含分离自视频的音频段）
  const allAudioWindows = useMemo(() => computeAudioWindows(segments).windows, [segments]);
  const audioTracks = [...new Set(allAudioWindows.map((item) => item.seg.track || 'A1'))];
  const videoRef = useRef(null);
  useEffect(() => {
    const video = videoRef.current;
    if (!video || active?.seg.type !== 'video') return;
    return clock.register('video', video, active, false, playing,
      () => useCompositionEditorStore.getState().cursor, pause);
  }, [clock, active, playing, seekEpoch, pause]);
  useEffect(() => {
    if (videoRef.current) videoRef.current.volume = Math.max(0, Math.min(1, v1Settings.volume ?? 1));
  }, [active, v1Settings.volume]);

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
      const next = clock.tick(cursorNow, dt, now, boundary);
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
    if (playing) pause();
    else play();
  };

  const restart = () => {
    seek(0);
    if (total > 0) play();
  };


  return (
    <div className="flex-1 flex flex-col overflow-hidden min-h-0">
      <div ref={viewportRef} className="relative min-h-0 min-w-0 flex-1 overflow-hidden bg-surface-content-area px-[12px] flex items-center justify-center">
        <div aria-label={`成片画布 ${aspectRatio}`} className="relative shrink-0 overflow-hidden bg-black" style={{ width: canvasWidth, height: canvasWidth / ratio }}>
        <div className="absolute inset-0 overflow-hidden flex items-center justify-center">
          {!active ? (
            <span className="text-text-hint text-font-size-14" style={{ fontFamily: FONT, visibility: segments.length ? 'hidden' : 'visible' }}>
              从左侧添加素材开始剪辑
            </span>
          ) : active.seg.type === 'video' && active.seg.sourceUrl && !v1Settings.hidden ? (
            <video
              key={active.seg.sourceUrl}
              ref={videoRef}
              src={active.seg.sourceUrl}
              className="w-full h-full object-contain"
              muted={v1Settings.volume <= 0 || active.seg.hasAudio === false}
              volume={v1Settings.volume}
              playsInline
            />
          ) : active.seg.type === 'video' && v1Settings.hidden ? (
            <div className="h-full w-full bg-surface-content-area" aria-label="V1 轨道已隐藏" />
          ) : (
            <img
              key={active.seg.id}
              src={active.seg.posterUrl || active.seg.thumbnailUrl || active.seg.sourceUrl}
              alt=""
              className="w-full h-full object-contain"
            />
          )}
        </div>
        <SubtitlePreview cues={activeSubtitles} />
        </div>
      </div>

      {/* 控制条 */}
      <PlaybackControls playing={playing} cursor={cursor} total={total} onToggle={togglePlay} onRestart={restart} onSeek={seek} />

      {audioTracks.map((track) => <PreviewAudioLayer key={track} track={track} clock={clock} seekEpoch={seekEpoch}
        active={allAudioWindows.find((item) => (item.seg.track || 'A1') === track && cursor >= item.start && cursor < item.end)}
        playing={playing} settings={trackSettings[track]} />)}
    </div>
  );
}
