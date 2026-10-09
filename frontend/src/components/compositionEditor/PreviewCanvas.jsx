import { useEffect, useMemo, useRef, useState } from 'react';
import { computeVisualWindows, computeAudioWindows, computeSubtitleWindows, computeTotalDuration, useCompositionEditorStore } from '../../stores/compositionEditorStore';
import PlaybackControls from './PlaybackControls';
import PreviewAudioLayer from './PreviewAudioLayer';
import SubtitlePreview from './SubtitlePreview';

const FONT = "'AlibabaPuHuiTi 2_55 Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif";

// 同一媒体元素只能创建一次 source，复用以兼容 StrictMode 的 effect 重放。
const audioGraphs = new WeakMap();
let previewAudioContext;
function getAudioGraph(audio) {
  if (audioGraphs.has(audio)) return audioGraphs.get(audio);
  previewAudioContext ??= new AudioContext();
  const source = previewAudioContext.createMediaElementSource(audio);
  const gain = previewAudioContext.createGain();
  source.connect(gain);
  const graph = { context: previewAudioContext, gain };
  audioGraphs.set(audio, graph);
  return graph;
}

/** 片段有效倍速（缺省/非法回退 1；图片恒 1，与 store 口径一致） */
function speedOf(seg) {
  if (!seg || seg.type === 'image') return 1;
  const speed = Number(seg.speed);
  return Number.isFinite(speed) && speed > 0 ? speed : 1;
}

function activeIndexFor(windows, cursor, total) {
  if (!windows.length) return -1;
  for (let i = 0; i < windows.length; i += 1) {
    if (cursor >= windows[i].start && cursor < windows[i].end) return i;
  }
  if (total > 0 && cursor >= total) return windows.length - 1;
  return -1;
}

/**
 * 图片段渲染：transition='fade'（缺省按 fade）时 CSS opacity 淡入淡出。
 * 淡入：挂载即 opacity 0，经双 rAF 设 1 触发过渡（setState 均在帧回调中）；
 * 淡出：播放中在段尾 fadeD 前回落 0（与父级推进定时器并存）。
 */
function FadeImage({ src, duration, playing, fadeOn, fadeDur }) {
  const [opacity, setOpacity] = useState(fadeOn ? 0 : 1);

  // 淡入：挂载 / fade 开启时 0 → 1（挂载场景初始已是 0，归零为幂等兜底）
  useEffect(() => {
    if (!fadeOn) return;
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      setOpacity(0);
      raf2 = requestAnimationFrame(() => setOpacity(1));
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [fadeOn]);

  // 淡出：播放中在段尾 fadeD 前触发 1 → 0
  useEffect(() => {
    if (!fadeOn || !playing) return;
    const timer = setTimeout(() => setOpacity(0), Math.max(0, (duration - fadeDur) * 1000));
    return () => clearTimeout(timer);
  }, [fadeOn, playing, duration, fadeDur]);

  return (
    <img
      src={src}
      alt=""
      className="w-full h-full object-contain"
      style={fadeOn ? { opacity, transition: `opacity ${fadeDur}s ease` } : undefined}
    />
  );
}

export default function PreviewCanvas() {
  const segments = useCompositionEditorStore((s) => s.segments);
  const playing = useCompositionEditorStore((s) => s.playing);
  const cursor = useCompositionEditorStore((s) => s.cursor);
  const play = useCompositionEditorStore((s) => s.play);
  const pause = useCompositionEditorStore((s) => s.pause);
  const seek = useCompositionEditorStore((s) => s.seek);
  const onCursorTick = useCompositionEditorStore((s) => s.onCursorTick);
  const trackSettings = useCompositionEditorStore((s) => s.trackSettings);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.code !== 'Space' || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.isComposing) return;
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || target.closest('input, textarea, select, [role="textbox"], [role="dialog"], [role="alertdialog"]'))) return;
      if (document.querySelector('[aria-modal="true"], dialog[open]')) return;
      const state = useCompositionEditorStore.getState();
      if (!state.loaded) return;
      event.preventDefault();
      event.stopPropagation();
      if (event.repeat) return;
      if (state.playing) state.pause();
      else state.play();
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
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
  const audioWindows = useMemo(() => allAudioWindows.filter((item) => (item.seg.track || 'A1') === 'A1'), [allAudioWindows]);
  const extraAudioTracks = [...new Set(allAudioWindows.map((item) => item.seg.track || 'A1'))].filter((track) => track !== 'A1');
  const activeAudio = useMemo(() => {
    for (let i = 0; i < audioWindows.length; i += 1) {
      if (cursor >= audioWindows[i].start && cursor < audioWindows[i].end) return audioWindows[i];
    }
    return null;
  }, [audioWindows, cursor]);

  // 图片 fade 参数：transition 为 'fade'（缺省按 fade）时启用，时长 min(0.4, duration/2)
  const imgFadeOn = active?.seg?.type === 'image' && (active.seg.transition || 'fade') === 'fade';
  const imgFadeDur = active?.seg ? Math.min(0.4, Math.max(0, Number(active.seg.duration) || 0) / 2) : 0.4;

  const videoRef = useRef(null);
  const audioRef = useRef(null);
  const audioUrlRef = useRef(null);
  const audioGraphRef = useRef(null);

  useEffect(() => {
    const graph = getAudioGraph(audioRef.current);
    audioGraphRef.current = graph;
    graph.gain.connect(graph.context.destination);
    const resume = () => {
      if (graph.context.state === 'suspended') graph.context.resume().catch(() => {});
    };
    window.addEventListener('pointerdown', resume);
    window.addEventListener('keydown', resume);
    return () => {
      window.removeEventListener('pointerdown', resume);
      window.removeEventListener('keydown', resume);
      graph.gain.disconnect();
      audioGraphRef.current = null;
    };
  }, []);

  // 播放态驱动视频元素：playing 时真实播放（autoPlay 属性变更不会触发已挂载视频）
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !active || active.seg.type !== 'video') return;
    if (playing) v.play().catch(() => {});
    else v.pause();
  }, [playing, active]);

  // 视频片段：段切换时设置倍速 + 时间同步（源时间 = offset + (cursor − start) × speed）
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !active || active.seg.type !== 'video') return;
    const speed = speedOf(active.seg);
    v.volume = Math.max(0, Math.min(1, v1Settings.volume ?? 1));
    if (v.playbackRate !== speed) v.playbackRate = speed;
    const target = (active.seg.offset || 0) + (cursor - active.start) * speed;
    if (v.readyState >= 1 && Math.abs((v.currentTime || 0) - target) > 0.15) {
      v.currentTime = Math.max(0, target);
    }
  }, [cursor, playing, active, v1Settings.volume]);

  // 视频准备就绪后对齐到播放头对应的源时间（含倍速换算；播放中切段同样对齐）
  const handleLoadedMetadata = () => {
    const v = videoRef.current;
    if (!v || !active || active.seg.type !== 'video') return;
    const speed = speedOf(active.seg);
    v.currentTime = Math.max(0, (active.seg.offset || 0) + (cursor - active.start) * speed);
  };

  // 音轨播放层：隐藏 audio 跟随 cursor 播放活跃音频段（仅同步跟随，不驱动 cursor）
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const seg = activeAudio?.seg;
    const url = seg?.sourceUrl || null;
    if (!seg || !url) {
      // 无活跃音频段（间隙 / 结尾 / 空源）：暂停，src 保留供段回归时复用
      audio.pause();
      return;
    }
    // 段变化时才换 src，避免同源相邻段重复重载
    if (audioUrlRef.current !== url) {
      audio.src = url;
      audioUrlRef.current = url;
    }
    const speed = speedOf(seg);
    audio.volume = 1;
    const graph = audioGraphRef.current;
    if (graph) {
      graph.gain.gain.setValueAtTime(Math.max(0, Math.min(2, (seg.volume ?? 1) * (trackSettings.A1?.volume ?? 1))), graph.context.currentTime);
      if (playing && graph.context.state === 'suspended') graph.context.resume().catch(() => {});
    }
    if (audio.playbackRate !== speed) audio.playbackRate = speed;
    const offset = seg.offset || 0;
    const target = offset + (cursor - activeAudio.start) * speed;
    if (audio.readyState >= 1 && Math.abs((audio.currentTime || 0) - target) > 0.15) {
      audio.currentTime = Math.max(0, target);
    }
    if (playing) {
      // 自动播放策略拒绝时静默忽略（用户点击播放按钮后一般允许）
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, [activeAudio, cursor, playing, trackSettings.A1?.volume]);

  // 音频源就绪后兜底对齐（换源瞬间 readyState 未就绪，effect 校正会被跳过）
  const handleAudioLoadedMetadata = () => {
    const audio = audioRef.current;
    if (!audio || !activeAudio) return;
    const seg = activeAudio.seg;
    const speed = speedOf(seg);
    audio.currentTime = Math.max(0, (seg.offset || 0) + (cursor - activeAudio.start) * speed);
  };

  // 图片片段：播放中用 rAF 逐帧推进 cursor（游标线随播放平滑移动），到段尾衔接下一段
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
      const next = Math.min(cursorNow + dt, total);
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
  }, [playing, total, onCursorTick, pause]);

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
      <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden bg-surface-content-area">
        <div className="absolute inset-0 overflow-hidden bg-surface-content-area flex items-center justify-center">
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
              onLoadedMetadata={handleLoadedMetadata}
            />
          ) : active.seg.type === 'video' && v1Settings.hidden ? (
            <div className="h-full w-full bg-surface-content-area" aria-label="V1 轨道已隐藏" />
          ) : (
            <FadeImage
              key={active.seg.id}
              src={active.seg.posterUrl || active.seg.thumbnailUrl || active.seg.sourceUrl}
              duration={Number(active.seg.duration) || 0}
              playing={playing}
              fadeOn={imgFadeOn}
              fadeDur={imgFadeDur}
            />
          )}
        </div>
        <SubtitlePreview cues={activeSubtitles} />
      </div>

      {/* 控制条 */}
      <PlaybackControls playing={playing} cursor={cursor} total={total} onToggle={togglePlay} onRestart={restart} onSeek={seek} />

      {/* 音轨播放层：隐藏 audio 承载 A1 音频（含分离出的视频原声），视频保持静音 */}
      <audio ref={audioRef} crossOrigin="anonymous" preload="auto" hidden muted={trackSettings.A1?.hidden || trackSettings.A1?.volume <= 0} onLoadedMetadata={handleAudioLoadedMetadata} />
      {extraAudioTracks.map((track) => <PreviewAudioLayer key={track} active={allAudioWindows.find((item) => item.seg.track === track && cursor >= item.start && cursor < item.end)} cursor={cursor} playing={playing} settings={trackSettings[track]} />)}
    </div>
  );
}
