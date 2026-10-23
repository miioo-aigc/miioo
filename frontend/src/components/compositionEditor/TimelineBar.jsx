/**
 * @file TimelineBar.jsx
 * @structure-index
 *
 * 时间线结构：素材展示辅助组件 L63；状态与缩放 L116；拖拽预览与提交 L220；
 * 定位与播放游标 L402；片段卡片 L460；轨道布局与工具栏 L527。
 *
 * 更新记录：2026-10-09 增强时间刻度对比度；吸顶刻度内补齐手柄到轨道游标线连接段。
 * 2026-10-15 全选高亮、拖拽快捷键隔离及 Esc 取消；键盘分发独立于时间线展示。2026-10-23 倍速文字改为 80% 白色，隔离横向滚动边界手势。
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import TimelineToolbar from './TimelineToolbar';
import { ZoomIn, ZoomOut } from 'lucide-react';
import TrackControls from './TrackControls';
import MainTrackButton from './MainTrackButton';
import SubtitleTrimHandles from './SubtitleTrimHandles';
import {
  formatTime,
  computeVisualWindows,
  computeAudioWindows,
  computeSubtitleWindows,
  computeTotalDuration,
  useCompositionEditorStore,
} from '../../stores/compositionEditorStore';

const FONT = "'AlibabaPuHuiTi 2_55 Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif";
const FONT_MEDIUM = "'AlibabaPuHuiTi_2_65_Medium','Alibaba PuHuiTi 2.0',system-ui,sans-serif";

// 时间线缩放（pxPerSecond）：默认/重置 24，区间 4~240，Ctrl/Cmd+滚轮每档 ×1.1
const ZOOM_MIN = 4;
const ZOOM_MAX = 240;
const ZOOM_FACTOR = 1.1;
// 内容区右侧固定留白（不承载刻度，仅作时间线末端呼吸空间）
const TRAILING_PAD = 24;
// 刻度步进档位（秒）与标签最小间距：取「步进 × zoom ≥ 60px」的最小档，全部不足时用最大档
const TICK_STEPS = [0.5, 1, 2, 5, 10, 30, 60, 300, 600];
const TICK_MIN_PX = 60;

const CLIP_H = 80;
const AUDIO_CLIP_H = 56;
const SUBTITLE_CLIP_H = 40;
const TRACK_TOP_GAP = 4;
const VIDEO_ROW_H = TRACK_TOP_GAP + CLIP_H;
const AUDIO_ROW_H = TRACK_TOP_GAP + AUDIO_CLIP_H;
const RULER_H = 26;
const PREVIEW_WAVEFORM = [
  0.08, 0.12, 0.2, 0.16, 0.28, 0.42, 0.56, 0.38, 0.24, 0.18, 0.3, 0.48,
  0.64, 0.58, 0.76, 0.62, 0.44, 0.32, 0.26, 0.2, 0.34, 0.5, 0.68, 0.8,
  0.72, 0.54, 0.46, 0.38, 0.24, 0.18, 0.26, 0.42, 0.56, 0.48, 0.36, 0.3,
  0.22, 0.16, 0.12, 0.2, 0.32, 0.46, 0.62, 0.74, 0.66, 0.5, 0.38, 0.28,
  0.2, 0.14, 0.18, 0.3, 0.44, 0.58, 0.7, 0.62, 0.48, 0.34, 0.24, 0.18,
  0.12, 0.16, 0.3, 0.54, 0.72, 0.86, 0.78, 0.6, 0.42, 0.3, 0.22, 0.14,
];

function ZoomInIcon() {
  return <ZoomIn size={16} />;
}

function ZoomOutIcon() {
  return <ZoomOut size={16} />;
}

function VideoFilmstrip({ src, poster, offset = 0, duration = 0, speed = 1 }) {
  const frameCount = 5;
  const videoRefs = useRef([]);
  const [readyFrames, setReadyFrames] = useState(() => new Set());
  const setFrame = (index, event) => {
    const video = event.currentTarget;
    const sourceStart = Math.max(0, Number(offset) || 0);
    const sourceDuration = Math.max(0, (Number(duration) || 0) * (Number(speed) > 0 ? Number(speed) : 1));
    const frameTime = sourceStart + sourceDuration * (index + 0.5) / frameCount;
    if (video.readyState >= 1) video.currentTime = Math.max(0, frameTime);
  };
  const markReady = (index) => setReadyFrames((previous) => {
    if (previous.has(index)) return previous;
    const next = new Set(previous);
    next.add(index);
    return next;
  });
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[18px] bottom-[16px] z-0 flex bg-[#262626]" aria-hidden="true">
      {Array.from({ length: frameCount }, (_, index) => (
        <video
          key={index}
          ref={(element) => { videoRefs.current[index] = element; }}
          src={src}
          poster={poster || undefined}
          muted
          playsInline
          preload="auto"
          onLoadedMetadata={(event) => setFrame(index, event)}
          onLoadedData={(event) => setFrame(index, event)}
          onSeeked={() => markReady(index)}
          onError={() => markReady(index)}
          className="h-full min-w-0 flex-1 object-cover"
          style={{ opacity: readyFrames.has(index) ? 1 : 0 }}
        />
      ))}
    </div>
  );
}

function ImageFilmstrip({ src }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[18px] bottom-[16px] z-0 flex overflow-hidden bg-[#262626]" aria-hidden="true">
      {Array.from({ length: 5 }, (_, index) => <img key={index} src={src} alt="" className="h-full min-w-0 flex-1 object-cover" />)}
    </div>
  );
}

function PreviewWaveform({ values }) {
  const points = values.map((amplitude, index) => `${(index / Math.max(1, values.length - 1)) * 100},${100 - Math.max(8, Math.min(100, Number(amplitude) * 100))}`).join(' ');
  return <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full" aria-hidden="true"><polygon points={`0,100 ${points} 100,100`} fill="currentColor" /></svg>;
}

export default function TimelineBar({ showToast }) {
  const segments = useCompositionEditorStore((s) => s.segments);
  const cursor = useCompositionEditorStore((s) => s.cursor);
  const zoom = useCompositionEditorStore((s) => s.zoom);
  const selectedId = useCompositionEditorStore((s) => s.selectedId);
  const selectedIds = useCompositionEditorStore((s) => s.selectedIds);
  const select = useCompositionEditorStore((s) => s.select);
  const seek = useCompositionEditorStore((s) => s.seek);
  const setZoom = useCompositionEditorStore((s) => s.setZoom);
  const trackSettings = useCompositionEditorStore((s) => s.trackSettings);
  const mainTracks = useCompositionEditorStore((s) => s.mainTracks);
  const setMainTrack = useCompositionEditorStore((s) => s.setMainTrack);
  const setTrackSetting = useCompositionEditorStore((s) => s.setTrackSetting);

  const scrollRef = useRef(null);
  const trackLabelRef = useRef(null);
  // 指针锚定：缩放后待校正的 scrollLeft，待 zoom 变更提交 DOM 后再落地
  const pendingScrollRef = useRef(null);

  const playing = useCompositionEditorStore((s) => s.playing);
  const pointerDragRef = useRef(null);
  const [draggingId, setDraggingId] = useState(null);
  const [targetTrack, setTargetTrack] = useState(null);
  const [dragLayout, setDragLayout] = useState(null);
  const [showNewTrack, setShowNewTrack] = useState(null);
  const layoutSegments = draggingId ? dragLayout.segments : segments;

  const { windows: visualWindows } = computeVisualWindows(segments);
  const { windows: audioAux } = computeAudioWindows(segments);
  const { windows: subtitleAux } = computeSubtitleWindows(segments);
  const visualTracks = [...new Set(['V1', ...layoutSegments.filter((seg) => seg.type === 'video' || seg.type === 'image').map((seg) => seg.track || 'V1')])]
    .sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
  const audioTracks = [...new Set(['A1', ...layoutSegments.filter((seg) => seg.type === 'audio').map((seg) => seg.track || 'A1')])]
    .sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
  const subtitleTracks = [...new Set(['S1', ...layoutSegments.filter((seg) => seg.type === 'subtitle').map((seg) => seg.track || 'S1')])];
  const trackRows = [[subtitleTracks, 'S', 'subtitle'], [visualTracks, 'V', 'visual'], [audioTracks, 'A', 'audio']].flatMap(([tracks, prefix, type]) => {
    const max = Math.max(...tracks.map((track) => Number(track.slice(1))), ...Object.keys(trackSettings).filter((track) => track.startsWith(prefix)).map((track) => Number(track.slice(1))));
    return Array.from({ length: max }, (_, index) => {
      const track = `${prefix}${index + 1}`;
      if (!tracks.includes(track)) return [];
      if (!layoutSegments.some((seg) => (prefix === 'V' ? seg.type === 'video' || seg.type === 'image' : seg.type === type) && (seg.track || `${prefix}1`) === track)) return [];
      const height = prefix === 'S' ? TRACK_TOP_GAP + SUBTITLE_CLIP_H : prefix === 'A' ? AUDIO_ROW_H : VIDEO_ROW_H;
      const row = { track, type, height };
      return draggingId && showNewTrack?.after === track && max < 6
        ? [row, { track: `${prefix}${max + 1}`, type, height, isNew: true }] : [row];
    }).flat();
  });
  const rowTop = (index) => RULER_H + trackRows.slice(0, index).reduce((total, row) => total + row.height, 0);
  const trackHeight = trackRows.reduce((total, row) => total + row.height, 0);
  // 图标列仅跟随偏移，不使用独立 scrollTop，避免两列滚动范围不同导致钳制错位。
  useLayoutEffect(() => {
    if (trackLabelRef.current && scrollRef.current) {
      trackLabelRef.current.style.transform = `translateY(${-scrollRef.current.scrollTop}px)`;
    }
  });
  // 总时长口径统一走 store 的 computeTotalDuration（V1 可视总长 / A1 最末端取大）
  const timeMax = Math.max(computeTotalDuration(segments), 0.001);
  const contentWidth = Math.max(320, Math.round(timeMax * zoom) + TRAILING_PAD);

  // Ctrl/Cmd+滚轮缩放：React 合成 onWheel 无法可靠 preventDefault（root 级 wheel
  // 监听被浏览器按 passive 处理存在行为差异），故对滚动容器手动绑非 passive 原生监听
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return undefined;
    const onWheel = (event) => {
      if (!event.ctrlKey && !event.metaKey) {
        const deltaX = event.deltaX || (event.shiftKey ? event.deltaY : 0);
        const atStart = container.scrollLeft <= 1;
        const atEnd = container.scrollLeft >= container.scrollWidth - container.clientWidth - 1;
        // 边界外的横向手势不交给浏览器历史导航，轨道内部仍使用原生滚动。
        if (Math.abs(deltaX) > 0 && (event.shiftKey || Math.abs(deltaX) >= Math.abs(event.deltaY))
          && ((deltaX < 0 && atStart) || (deltaX > 0 && atEnd))) event.preventDefault();
        return;
      }
      event.preventDefault(); // 阻止浏览器页面缩放（含触控板 pinch 合成的 ctrl+wheel）
      const oldZoom = useCompositionEditorStore.getState().zoom;
      const sign = event.deltaY < 0 ? 1 : -1; // 滚轮向上 = 放大
      const nextZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, oldZoom * ZOOM_FACTOR ** sign));
      if (nextZoom === oldZoom) return;
      // 指针锚定（内容坐标基准：time=0 在内容左缘，容器无前导 padding）：
      // timeAtPointer = (scrollLeft + 指针相对容器左缘偏移) / oldZoom
      const rect = container.getBoundingClientRect();
      const pointerX = event.clientX - rect.left;
      const timeAtPointer = (container.scrollLeft + pointerX) / oldZoom;
      // 缩放后让同一时间点仍落在指针处：newScrollLeft = timeAtPointer × newZoom − pointerX
      pendingScrollRef.current = timeAtPointer * nextZoom - pointerX;
      setZoom(nextZoom);
    };
    container.addEventListener('wheel', onWheel, { passive: false });
    return () => container.removeEventListener('wheel', onWheel);
  }, [setZoom]);

  // zoom 变化的 DOM 提交后再校正滚动位置（此刻 scrollWidth 已按新缩放更新，可正确钳制边界）
  useLayoutEffect(() => {
    const container = scrollRef.current;
    if (!container || pendingScrollRef.current == null) return;
    const target = pendingScrollRef.current;
    pendingScrollRef.current = null;
    const maxScroll = Math.max(0, container.scrollWidth - container.clientWidth);
    container.scrollLeft = Math.min(Math.max(0, target), maxScroll);
  }, [zoom]);

  const suppressClickRef = useRef(false);
  const [insertionIndex, setInsertionIndex] = useState(null);
  const [draggingStart, setDraggingStart] = useState(null);

  const getInsertionTarget = (pointerTime, drag) => {
    const windows = (drag.prefix === 'S' ? computeSubtitleWindows : drag.isAudio ? computeAudioWindows : computeVisualWindows)(drag.before.segments, drag.targetTrack).windows.filter((window) => window.seg.id !== drag.id);
    let target = null;
    windows.forEach((window, index) => {
      [{ time: window.start, index }, { time: window.end, index: index + 1 }].forEach((edge) => {
        const distance = Math.abs(pointerTime - edge.time) * zoom;
        if (distance <= 8 && (!target || distance < target.distance)) target = { ...edge, distance };
      });
    });
    return target;
  };

  const getInsertionLeft = (targetIndex) => {
    return targetIndex.time * zoom;
  };


  const getSnappedStart = (start, drag, event) => {
    if (event.altKey) return start;
    const threshold = Math.min(0.1, 8 / zoom);
    const candidates = [{ time: cursor, priority: 0 }, { time: 0, priority: 2 }];
    const windows = drag.prefix === 'S' ? subtitleAux : drag.isAudio ? audioAux : visualWindows;
    windows.forEach((window) => {
      if (window.seg.id === drag.id) return;
      candidates.push({ time: window.start, priority: 1 }, { time: window.end, priority: 1 });
    });
    const edges = [{ value: start, offset: 0 }, { value: start + drag.duration, offset: drag.duration }];
    let best = null;
    edges.forEach((edge) => candidates.forEach((candidate) => {
      const delta = candidate.time - edge.value;
      if (Math.abs(delta) > threshold) return;
      const item = { start: start + delta, priority: candidate.priority, distance: Math.abs(delta) };
      if (!best || item.priority < best.priority || (item.priority === best.priority && item.distance < best.distance)) best = item;
    }));
    return best ? Math.max(0, best.start) : Math.max(0, start);
  };

  const updateVisualPointerDrag = (event) => {
    event.preventDefault();
    const drag = pointerDragRef.current;
    const content = scrollRef.current?.firstElementChild;
    if (!drag?.active || !content) return;
    const rows = [...content.querySelectorAll('[data-drop-track]')];
    const prefix = drag.prefix;
    const existingRows = rows.filter((element) => element.dataset.dropTrack.startsWith(prefix) && element.dataset.newTrack !== 'true');
    const viewport = scrollRef.current.getBoundingClientRect();
    const inside = event.clientX >= viewport.left && event.clientX <= viewport.right
      && event.clientY >= viewport.top && event.clientY <= viewport.bottom;
    const anchor = inside && existingRows.length < 6 ? existingRows.find((element) => {
      const boundary = element.getBoundingClientRect().bottom;
      const expanded = drag.newTrackAfter === element.dataset.dropTrack;
      return event.clientY >= boundary - 16 && event.clientY <= boundary + (expanded ? (drag.isAudio ? AUDIO_ROW_H : VIDEO_ROW_H) : 16);
    }) : null;
    drag.newTrackAfter = anchor?.dataset.dropTrack || null;
    setShowNewTrack(anchor ? { after: drag.newTrackAfter } : null);
    const boundary = anchor?.getBoundingClientRect().bottom;
    const row = rows.find((element) => {
      const rect = element.getBoundingClientRect();
      return element.dataset.newTrack !== 'true' && event.clientY >= rect.top && event.clientY < rect.bottom;
    });
    const newTrackTarget = anchor && event.clientY >= boundary;
    const track = !inside ? null : newTrackTarget
      ? `${prefix}${existingRows.length + 1}` : row?.dataset.dropTrack;
    drag.insertAt = newTrackTarget ? Number(anchor.dataset.dropTrack.slice(1)) + 1 : null;
    if (!track || !track.startsWith(prefix)) {
      drag.valid = false;
      setInsertionIndex(null);
      return;
    }
    drag.valid = true;
    drag.targetTrack = track;
    setTargetTrack(track);
    const pointerTime = (event.clientX - content.getBoundingClientRect().left) / zoom;
    const raw = pointerTime - drag.grabOffset;
    const insertion = getInsertionTarget(pointerTime, drag);
    const start = insertion?.time ?? getSnappedStart(raw, drag, event);
    drag.moved = drag.moved || Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) >= 5;
    drag.currentStart = start;
    drag.insertionIndex = insertion;
    if (drag.moved) {
      suppressClickRef.current = true;
      setInsertionIndex(drag.insertionIndex);
      setDraggingStart(Math.max(0, raw));
      useCompositionEditorStore.getState().previewTrackSegment(drag.id, track, start, drag.before, insertion);
    }
  };

  const finishVisualPointerDrag = (event) => {
    const drag = pointerDragRef.current;
    if (!drag) return;
    drag.cleanup();
    updateVisualPointerDrag(event);
    if (drag.moved) {
      const store = useCompositionEditorStore.getState();
      if (drag.valid) store.commitTrackDrag(drag.id, drag.before, drag.insertAt);
      else useCompositionEditorStore.setState({ segments: drag.before.segments });
    }
    if (!drag.moved) select(drag.id);
    pointerDragRef.current = null;
    setDraggingId(null);
    setShowNewTrack(false);
    setInsertionIndex(null);
    setTargetTrack(null);
    setDraggingStart(null);
  };

  const startTrackPointerDrag = (event, seg, win, isAudio) => {
    if (event.button !== 0 || event.target.closest('button') || pointerDragRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    const content = scrollRef.current?.firstElementChild;
    if (!content) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const trackRect = event.currentTarget.parentElement?.getBoundingClientRect();
    pointerDragRef.current = { id: seg.id, isAudio, duration: win.end - win.start, grabOffset: (event.clientX - rect.left) / zoom, start: win.start, currentStart: win.start, startX: event.clientX, startY: event.clientY, moved: false, before: { segments: useCompositionEditorStore.getState().segments, selectedId }, trackTop: trackRect?.top ?? 0, trackBottom: trackRect?.bottom ?? window.innerHeight };
    const drag = pointerDragRef.current;
    const dragElement = event.currentTarget;
    dragElement.dataset.timelineDragging = 'true';
    drag.before.selectedIds = useCompositionEditorStore.getState().selectedIds;
    drag.before.trackSettings = useCompositionEditorStore.getState().trackSettings;
    drag.before.mainTracks = useCompositionEditorStore.getState().mainTracks;
    drag.prefix = seg.type === 'subtitle' ? 'S' : isAudio ? 'A' : 'V';
    const pointerId = event.pointerId;
    drag.targetTrack = seg.track || `${drag.prefix}1`;
    suppressClickRef.current = false;
    select(seg.id);
    const move = (moveEvent) => {
      if (moveEvent.pointerId === pointerId) updateVisualPointerDrag(moveEvent);
    };
    const up = (upEvent) => {
      if (upEvent.pointerId !== pointerId) return;
      finishVisualPointerDrag(upEvent);
    };
    const cancel = (cancelEvent) => {
      if (!['blur', 'timeline:cancel-drag'].includes(cancelEvent.type) && cancelEvent.pointerId !== pointerId) return;
      if (cancelEvent.type === 'timeline:cancel-drag') cancelEvent.preventDefault();
      drag.cleanup();
      if (drag.moved) useCompositionEditorStore.setState({ segments: drag.before.segments });
      pointerDragRef.current = null;
      setDraggingId(null);
      setShowNewTrack(false);
      setInsertionIndex(null);
      setTargetTrack(null);
      setDraggingStart(null);
    };
    const timer = window.setTimeout(() => {
      if (pointerDragRef.current !== drag) return;
      drag.active = true;
      setDragLayout({ segments: drag.before.segments, isAudio });
      suppressClickRef.current = true;
      setDraggingId(seg.id);
      setTargetTrack(drag.targetTrack);
      useCompositionEditorStore.getState().pause();
    }, 100);
    drag.cleanup = () => {
      delete dragElement.dataset.timelineDragging;
      window.clearTimeout(timer);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      window.removeEventListener('blur', cancel);
      window.removeEventListener('timeline:cancel-drag', cancel);
    };
    setInsertionIndex(null);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    window.addEventListener('blur', cancel);
    window.addEventListener('timeline:cancel-drag', cancel);
  };

  useEffect(() => () => {
    const drag = pointerDragRef.current;
    if (!drag) return;
    drag.cleanup();
    if (drag.moved) useCompositionEditorStore.setState({ segments: drag.before.segments });
    pointerDragRef.current = null;
  }, []);

  // 缩放控件动作（setZoom 内部统一钳 4~240）
  const zoomIn = () => setZoom(zoom * ZOOM_FACTOR);
  const zoomOut = () => setZoom(zoom / ZOOM_FACTOR);

  const seekAtPointer = (clientX) => {
    const container = scrollRef.current;
    if (!container) return;
    const content = container.firstElementChild;
    const position = clientX - (content?.getBoundingClientRect().left ?? container.getBoundingClientRect().left);
    seek(Math.max(0, Math.min(timeMax, position / zoom)));
  };

  const clickTrack = (event) => seekAtPointer(event.clientX);

  const dragPlayhead = (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    useCompositionEditorStore.getState().pause();
    e.currentTarget.setPointerCapture(e.pointerId);
    seekAtPointer(e.clientX);
  };

  const movePlayhead = (event) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) seekAtPointer(event.clientX);
  };

  const endPlayheadDrag = (event) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  // 刻度步进自适应：满足「步进 × zoom ≥ 60px」的最小档，保证标签不重叠
  const tickStep = TICK_STEPS.find((step) => step * zoom >= TICK_MIN_PX) || TICK_STEPS[TICK_STEPS.length - 1];
  const tickMarks = [];
  const lastTick = Math.floor(timeMax / tickStep);
  for (let i = 0; i <= lastTick; i += 1) tickMarks.push(i * tickStep);
  const subdivisions = tickStep * zoom / 5 >= 8 ? 5 : 2;
  const minorStep = tickStep / subdivisions;
  const minorTicks = Array.from({ length: Math.floor(timeMax / minorStep) + 1 }, (_, index) => index)
    .filter((index) => index % subdivisions !== 0).map((index) => index * minorStep);
  const formatTick = (time) => tickStep < 1
    ? `${formatTime(time)}.${Math.round((time % 1) * 10)}` : formatTime(time);

  // 游标行：使用高对比中性灰，并置于卡片上层
  const playheadLeft = Math.min(cursor, timeMax) * zoom;

  // 播放中游标跟随：播放头即将出视口（右缘/左缘）时自动滚动，保持其在可视区左 30% 处；
  // 非播放态不干预用户手动滚动
  useEffect(() => {
    const container = scrollRef.current;
    if (!container || !playing) return;
    const visibleRight = container.scrollLeft + container.clientWidth;
    if (playheadLeft > visibleRight - 40 || playheadLeft < container.scrollLeft) {
      const target = playheadLeft - container.clientWidth * 0.3;
      const maxScroll = Math.max(0, container.scrollWidth - container.clientWidth);
      container.scrollLeft = Math.min(Math.max(0, target), maxScroll);
    }
  }, [playheadLeft, playing]);

  const renderCard = (win, isAudio) => {
    const seg = win.seg;
    const selected = seg.id === selectedId || selectedIds.includes(seg.id);
    const dragging = seg.id === draggingId;
    const draggableSegment = true;
    const track = seg.track || (isAudio ? 'A1' : seg.type === 'subtitle' ? 'S1' : 'V1');
    const thumb = seg.thumbnailUrl || seg.posterUrl;
    const width = Math.max(28, Math.round((win.end - win.start) * zoom));
    const speed = Number(seg.speed);
    const speedText = seg.type !== 'image' && Number.isFinite(speed) && speed > 0 && speed !== 1 ? ` · ${speed}x` : '';
    return (
      <div
        key={seg.id}
        draggable={false}
        onDoubleClick={() => { if (seg.type === 'subtitle') document.getElementById('subtitle-text-editor')?.focus(); }}
        onPointerDown={(event) => { if (draggableSegment) startTrackPointerDrag(event, seg, win, isAudio); }}
        onClick={(event) => { event.stopPropagation(); if (suppressClickRef.current) { suppressClickRef.current = false; return; } select(seg.id); seekAtPointer(event.clientX); }}
        className={`group absolute top-0 overflow-hidden rounded-medium border-2 flex flex-col justify-between !cursor-default ${
          selected
            ? 'bg-white-10 border-stroke-active'
            : 'bg-[#262626] border-transparent hover:bg-[#2d2d2d]'
        }`}
        style={{
          left: (dragging && draggingStart != null ? draggingStart : win.start) * zoom,
          width,
          height: seg.type === 'subtitle' ? SUBTITLE_CLIP_H : isAudio ? AUDIO_CLIP_H : CLIP_H,
          backgroundColor: isAudio ? 'var(--color-timeline-audio-bg)' : undefined,
          opacity: trackSettings[track]?.hidden ? 0.2 : 1,
          zIndex: dragging ? 50 : selected ? 20 : 1,
          transform: dragging ? 'translateY(-12px)' : undefined,
          borderColor: dragging ? 'var(--color-brand-main)' : undefined,
          boxShadow: dragging ? '0 8px 16px var(--color-timeline-drag-shadow)' : undefined,
          transition: dragging ? 'transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease' : 'left 300ms linear, transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease',
        }}
        title={`${seg.name || '片段'}${speedText}`}
      >
        {seg.type === 'video' && seg.sourceUrl && <VideoFilmstrip key={`${seg.id}-${seg.offset}-${seg.duration}-${seg.speed || 1}`} src={seg.sourceUrl} poster={thumb} offset={seg.offset} duration={seg.duration} speed={seg.speed} />}
        {seg.type === 'image' && thumb && <ImageFilmstrip src={thumb} />}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-white/0 transition-colors group-hover:bg-white/10" />
        {seg.type !== 'subtitle' && <div className="absolute inset-x-0 top-0 z-10 flex h-[18px] min-w-0 items-center gap-[4px] px-[6px] !cursor-default">
          <span className="truncate text-[11px] text-white-60" style={{ fontFamily: FONT }}>
            {seg.name || '片段'}
          </span>
          <span className="ml-auto shrink-0 text-[11px] text-white-60" style={{ fontFamily: FONT }}>{formatTime(seg.duration)}</span>
        </div>}

        {isAudio && <div className="absolute inset-x-[6px] top-[22px] bottom-[6px] text-timeline-audio-waveform" aria-hidden="true">
          <PreviewWaveform values={Array.isArray(seg.waveform) && seg.waveform.length > 0 ? seg.waveform : PREVIEW_WAVEFORM} />
        </div>}

        {seg.type === 'video' && seg.hasAudio !== false && <div className="absolute inset-x-[6px] bottom-[2px] z-10 flex h-[14px] items-center gap-[2px] text-timeline-audio-waveform" aria-hidden="true">
          <PreviewWaveform values={Array.isArray(seg.waveform) && seg.waveform.length > 0 ? seg.waveform : PREVIEW_WAVEFORM} />
        </div>}

        {seg.type === 'subtitle' && <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-purple-500/20 px-[6px] text-center text-[11px] text-white"><span className="truncate">{seg.text || '字幕'}</span></div>}
        {seg.type === 'subtitle' && seg.id === selectedId && <SubtitleTrimHandles segment={seg} zoom={zoom} />}

        <div className="absolute inset-x-[6px] bottom-[3px] flex items-center justify-between gap-[2px]">
          <span className="text-font-size-12 text-white-80 whitespace-nowrap" style={{ fontFamily: FONT }}>
            {speedText.replace(' · ', '')}
          </span>
        </div>

      </div>
    );
  };

  return (
    <div className="relative flex h-full w-full min-h-0 select-none flex-col bg-neutral-200">
      <div className="shrink-0 pr-[208px]"><TimelineToolbar showToast={showToast} /></div>
      {/* 滚动容器：承载全部时间线内容，Ctrl/Cmd+滚轮缩放绑定其上 */}
      <div className="flex h-full min-h-0 flex-1 overflow-hidden">
      <div className="relative w-[124px] shrink-0 overflow-hidden bg-neutral-200">
      <div className="absolute inset-x-0 top-0 z-[60] bg-neutral-200" style={{ height: RULER_H }} />
      <div ref={trackLabelRef} style={{ paddingTop: RULER_H, willChange: 'transform' }}>
        {trackRows.map(({ track, height, isNew }) => (
          <div key={track} className="group relative flex items-center justify-start gap-[6px] pl-[8px] text-font-size-12 text-text-hint" style={{ height, paddingTop: TRACK_TOP_GAP, boxSizing: 'border-box', fontFamily: FONT_MEDIUM }}>
            {!isNew && (track[0] !== 'S' || segments.some((seg) => seg.type === 'subtitle' && (seg.track || 'S1') === track)) && <MainTrackButton track={track} active={mainTracks[track[0]] === track} onChange={setMainTrack} />}
            {isNew && `+ ${track[0]}${Number(showNewTrack.after.slice(1)) + 1}`}
            {!isNew && (track[0] !== 'S' || segments.some((seg) => seg.type === 'subtitle' && (seg.track || 'S1') === track)) && <TrackControls track={track} settings={trackSettings[track] || { hidden: false, volume: 1, excludeGaps: false }} onChange={setTrackSetting} showToast={showToast} />}
          </div>
        ))}
      </div>
      </div>
      <div ref={scrollRef} className="timeline-scrollbar h-full min-h-0 min-w-0 flex-1 overflow-auto" onScroll={(event) => { if (trackLabelRef.current) trackLabelRef.current.style.transform = `translateY(${-event.currentTarget.scrollTop}px)`; }} style={{ scrollbarGutter: 'stable both-edges', overscrollBehaviorX: 'contain' }}>
        <div className="relative flex-shrink-0" style={{ width: contentWidth, minWidth: '100%', minHeight: RULER_H + trackHeight + 16, height: RULER_H + trackHeight + 16 }}>
          {/* 刻度（步进自适应，每格一个刻度 + 标签） */}
          <div className="sticky top-0 z-[60] bg-neutral-200" style={{ height: RULER_H, cursor: 'pointer' }} onClick={clickTrack}>
            {minorTicks.map((time) => <div key={time} className="absolute top-0 h-[5px] w-px bg-white/45" style={{ left: time * zoom }} />)}
            {tickMarks.map((t) => (
              <div key={t} className="absolute top-0 flex flex-col justify-between items-start" style={{ left: t * zoom, width: tickStep * zoom, height: RULER_H }}>
                <div className="h-[10px] w-px bg-white-70" />
                <span className="-translate-y-[4px] pl-[4px] text-[11px] text-white/75" style={{ fontFamily: FONT }}>
                  {formatTick(t)}
                </span>
              </div>
            ))}
            <div aria-hidden="true" className="pointer-events-none absolute top-[18px] bottom-0 w-[2px] bg-[#CCCCCC]" style={{ left: playheadLeft, transform: 'translateX(-1px)' }} />
            <div className="absolute inset-0 cursor-grab touch-none active:cursor-grabbing" onPointerDown={dragPlayhead} onPointerMove={movePlayhead} onPointerUp={endPlayheadDrag} onPointerCancel={endPlayheadDrag} aria-label="拖动播放游标" />
            <button type="button" aria-label="播放游标手柄" className="absolute top-0 flex h-[24px] w-[24px] cursor-grab touch-none items-start justify-center border-0 bg-transparent p-0 active:cursor-grabbing focus-visible:outline focus-visible:outline-1 focus-visible:outline-white-60" style={{ left: playheadLeft, transform: 'translateX(-50%)' }} onPointerDown={dragPlayhead} onPointerMove={movePlayhead} onPointerUp={endPlayheadDrag} onPointerCancel={endPlayheadDrag}>
              <span className="pointer-events-none h-[18px] w-[12px] rounded-b-[6px] bg-[#CCCCCC]" />
            </button>
          </div>

          {trackRows.map(({ track, type, isNew }, index) => {
            const rowWindows = type === 'visual'
              ? computeVisualWindows(segments, track).windows
              : type === 'audio' ? computeAudioWindows(segments, track).windows : subtitleAux.filter((window) => (window.seg.track || 'S1') === track);
            const cardHeight = type === 'subtitle' ? SUBTITLE_CLIP_H : type === 'audio' ? AUDIO_CLIP_H : CLIP_H;
            return <div key={track} data-drop-track={track} data-new-track={Boolean(isNew)} className={`absolute left-0 right-0 ${isNew ? 'border border-dashed border-stroke-active' : ''} ${targetTrack === track ? 'bg-tag-bg-blue' : ''}`} style={{ top: rowTop(index), height: trackRows[index].height }}>
              <div className="relative" style={{ height: cardHeight, marginTop: TRACK_TOP_GAP }} onClick={(event) => { event.stopPropagation(); select(null); }}>
                {rowWindows.map((window) => renderCard(window, type === 'audio'))}
                {track === targetTrack && draggingId && insertionIndex != null && (
                  <div aria-hidden="true" className="pointer-events-none absolute top-[-4px] z-40 h-[88px] w-[2px] rounded-full bg-brand-main shadow-[0_0_8px_var(--color-brand-main)] transition-[left] duration-300 ease-linear" style={{ left: getInsertionLeft(insertionIndex) }} />
                )}
              </div>
            </div>;
          })}

          {/* 游标线 */}
          <div className="absolute top-0 bottom-0 z-30 w-[2px] bg-[#CCCCCC] pointer-events-none" style={{ left: playheadLeft, transform: 'translateX(-1px)' }} />
        </div>
      </div>

      </div>
      <div className="absolute top-0 right-0 flex h-[40px] w-[208px] items-center justify-end gap-[8px] border-b border-stroke-normal px-[12px]">
        <button type="button" onClick={zoomOut} disabled={zoom <= ZOOM_MIN} aria-label="缩小时间线" title="缩小" className="flex h-[24px] w-[24px] items-center justify-center text-white-80 hover:text-white cursor-pointer border-0 bg-transparent disabled:text-text-disabled disabled:cursor-not-allowed">
          <ZoomOutIcon />
        </button>
        <input type="range" aria-label="时间线缩放" aria-valuetext={`${Math.round(zoom)} 像素每秒`} min={0} max={100} step={0.1} value={100 * Math.log(zoom / ZOOM_MIN) / Math.log(ZOOM_MAX / ZOOM_MIN)} onChange={(event) => setZoom(ZOOM_MIN * (ZOOM_MAX / ZOOM_MIN) ** (Number(event.target.value) / 100))} className="h-[4px] w-[112px] shrink-0 cursor-pointer appearance-none rounded-full bg-white-10 accent-white focus-visible:outline focus-visible:outline-1 focus-visible:outline-white-60 [&::-webkit-slider-thumb]:h-[12px] [&::-webkit-slider-thumb]:w-[12px] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-moz-range-thumb]:h-[12px] [&::-moz-range-thumb]:w-[12px] [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-white" style={{ backgroundImage: `linear-gradient(to right, rgba(255,255,255,0.4) ${100 * Math.log(zoom / ZOOM_MIN) / Math.log(ZOOM_MAX / ZOOM_MIN)}%, transparent 0)` }} />
        <button type="button" onClick={zoomIn} disabled={zoom >= ZOOM_MAX} aria-label="放大时间线" title="放大" className="flex h-[24px] w-[24px] items-center justify-center text-white-80 hover:text-white cursor-pointer border-0 bg-transparent disabled:text-text-disabled disabled:cursor-not-allowed">
          <ZoomInIcon />
        </button>
      </div>
    </div>
  );
}
