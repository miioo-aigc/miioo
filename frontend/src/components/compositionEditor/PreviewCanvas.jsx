import { useEffect, useMemo, useRef, useState } from 'react';
import { formatTime, computeVisualWindows, computeAudioWindows, useCompositionEditorStore } from '../../stores/compositionEditorStore';

const FONT = "'AlibabaPuHuiTi 2_55 Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif";

function PlayIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <path d="M5.333 3.333L11.333 8L5.333 12.667V3.333Z" fill="currentColor" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <path d="M4.667 3.333H6.667V12.667H4.667V3.333ZM9.333 3.333H11.333V12.667H9.333V3.333Z" fill="currentColor" />
    </svg>
  );
}

function RestartIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <path d="M8 4V1.5L5 3.5L8 5.5V4Z" fill="currentColor" />
      <path d="M4.5 4.5C3.1 5.6 2.2 7.3 2.2 9.2C2.2 12.4 4.8 15 8 15C11.2 15 13.8 12.4 13.8 9.2C13.8 7.3 12.9 5.6 11.5 4.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
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
  return 0;
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

  const { windows, total } = useMemo(() => computeVisualWindows(segments), [segments]);
  const activeIndex = activeIndexFor(windows, cursor, total);
  const active = activeIndex >= 0 ? windows[activeIndex] : null;

  // A1 音轨窗口与 cursor 所在的活跃音频段（含分离自视频的音频段）
  const audioWindows = useMemo(() => computeAudioWindows(segments).windows, [segments]);
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
    if (v.playbackRate !== speed) v.playbackRate = speed;
    const target = (active.seg.offset || 0) + (cursor - active.start) * speed;
    if (v.readyState >= 1 && Math.abs((v.currentTime || 0) - target) > 0.15) {
      v.currentTime = Math.max(0, target);
    }
  }, [cursor, playing, active]);

  // 视频准备就绪后对齐到播放头对应的源时间（含倍速换算；播放中切段同样对齐）
  const handleLoadedMetadata = () => {
    const v = videoRef.current;
    if (!v || !active || active.seg.type !== 'video') return;
    const speed = speedOf(active.seg);
    v.currentTime = Math.max(0, (active.seg.offset || 0) + (cursor - active.start) * speed);
  };

  const handleVideoTimeUpdate = () => {
    const v = videoRef.current;
    if (!v || !active || active.seg.type !== 'video') return;
    const offset = active.seg.offset || 0;
    const dur = Number(active.seg.duration) || 0;
    const speed = speedOf(active.seg);
    let currentWindow = active;
    for (let nextIndex = activeIndex + 1; nextIndex < windows.length; nextIndex += 1) {
      const nextWindow = windows[nextIndex];
      const sourceEnd = (Number(currentWindow.seg.offset) || 0)
        + Number(currentWindow.seg.duration) * speed;
      if (nextWindow.seg.type !== 'video'
        || nextWindow.seg.sourceUrl !== active.seg.sourceUrl
        || speedOf(nextWindow.seg) !== speed
        || Math.abs((Number(nextWindow.seg.offset) || 0) - sourceEnd) > 0.000001) break;
      if (v.currentTime < sourceEnd) break;
      currentWindow = nextWindow;
    }
    if (currentWindow !== active) {
      const nextCursor = currentWindow.start
        + (v.currentTime - (Number(currentWindow.seg.offset) || 0)) / speed;
      onCursorTick(Math.min(nextCursor, currentWindow.end));
      return;
    }
    // 段结束：源时间到达窗口末端（offset + duration × speed）即衔接下一段
    if (dur > 0 && v.currentTime >= offset + dur * speed) {
      advanceVisual();
      return;
    }
    // 源时间 → 时间线时间：(currentTime − offset) ÷ speed，夹在本段窗口内
    const tick = active.start + ((v.currentTime || 0) - offset) / speed;
    onCursorTick(Math.min(Math.max(tick, active.start), active.end));
  };

  const advanceVisual = () => {
    if (activeIndex < windows.length - 1) {
      seek(windows[activeIndex + 1].start);
    } else {
      pause();
      seek(total);
    }
  };

  const handleVideoEnded = () => advanceVisual();

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
  }, [activeAudio, cursor, playing]);

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
    if (!active || active.seg.type !== 'image' || !playing) return;
    let raf = 0;
    let lastTs = performance.now();
    const tick = () => {
      const now = performance.now();
      const dt = (now - lastTs) / 1000;
      lastTs = now;
      // 逐帧增量基于 store 最新 cursor，播放中 seek 后自动自校正
      const cursorNow = useCompositionEditorStore.getState().cursor;
      const next = Math.min(cursorNow + dt, active.end);
      if (next >= active.end - 1e-6) {
        advanceVisual();
        return;
      }
      onCursorTick(next);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, playing, active?.seg?.id]);

  const togglePlay = () => {
    if (playing) pause();
    else play();
  };

  const restart = () => {
    seek(0);
    if (windows.length > 0) play();
  };

  const seekByProgress = (e) => {
    if (total <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    seek(ratio * total);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-h-0">
      <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden bg-surface-content-area">
        <div className="absolute inset-0 overflow-hidden bg-surface-content-area flex items-center justify-center">
          {!active ? (
            <span className="text-text-hint text-font-size-14" style={{ fontFamily: FONT }}>
              从左侧添加素材开始剪辑
            </span>
          ) : active.seg.type === 'video' && active.seg.sourceUrl ? (
            <video
              key={active.seg.sourceUrl}
              ref={videoRef}
              src={active.seg.sourceUrl}
              className="w-full h-full object-contain"
              muted={false}
              playsInline
              onTimeUpdate={handleVideoTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onEnded={handleVideoEnded}
            />
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
      </div>

      {/* 控制条 */}
      <div className="flex items-center gap-[16px] px-[24px] h-[56px] bg-surface-toolbar border-t border-stroke-normal flex-shrink-0">
        <button
          type="button"
          onClick={togglePlay}
          disabled={!active}
          className="flex items-center justify-center w-[36px] h-[36px] rounded-medium bg-btn-primary-bg-normal hover:bg-btn-primary-bg-hover border border-btn-primary-border disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          <span className="text-btn-primary-text">{playing ? <PauseIcon /> : <PlayIcon />}</span>
        </button>

        <button
          type="button"
          onClick={restart}
          disabled={!active}
          className="flex items-center justify-center w-[36px] h-[36px] rounded-medium bg-btn-primary-bg-normal hover:bg-btn-primary-bg-hover border border-btn-primary-border disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          <span className="text-btn-primary-text"><RestartIcon /></span>
        </button>

        <span className="text-text-primary text-font-size-12 whitespace-nowrap" style={{ fontFamily: FONT }}>
          {formatTime(total > 0 ? Math.min(cursor, total) : cursor)} / {formatTime(total)}
        </span>

        <div className="flex-1 h-[2px] bg-white-10 rounded-full cursor-pointer relative"
          onClick={seekByProgress}>
          <div className="absolute left-0 top-0 h-full bg-brand-main rounded-full"
            style={{ width: total > 0 ? `${Math.min(100, (cursor / total) * 100)}%` : '0%' }} />
        </div>

        {total > 0 && cursor >= total && (
          <span className="text-text-hint text-font-size-12 whitespace-nowrap" style={{ fontFamily: FONT }}>
            播放完成
          </span>
        )}
      </div>

      {/* 音轨播放层：隐藏 audio 承载 A1 音频（含分离出的视频原声），视频保持静音 */}
      <audio ref={audioRef} preload="auto" hidden onLoadedMetadata={handleAudioLoadedMetadata} />
    </div>
  );
}
