import { useEffect, useLayoutEffect, useRef } from 'react';
import TimelineToolbar from './TimelineToolbar';
import {
  formatTime,
  computeVisualWindows,
  computeAudioWindows,
  computeTotalDuration,
  useCompositionEditorStore,
} from '../../stores/compositionEditorStore';

const FONT = "'AlibabaPuHuiTi 2_55 Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif";
const FONT_MEDIUM = "'AlibabaPuHuiTi_2_65_Medium','Alibaba PuHuiTi 2.0',system-ui,sans-serif";

// 时间线缩放（pxPerSecond）：默认/重置 24，区间 4~240，Ctrl/Cmd+滚轮每档 ×1.1
const ZOOM_DEFAULT = 24;
const ZOOM_MIN = 4;
const ZOOM_MAX = 240;
const ZOOM_FACTOR = 1.1;
// 内容区右侧固定留白（不承载刻度，仅作时间线末端呼吸空间）
const TRAILING_PAD = 24;
// 刻度步进档位（秒）与标签最小间距：取「步进 × zoom ≥ 60px」的最小档，全部不足时用最大档
const TICK_STEPS = [1, 5, 10, 30, 60, 300, 600];
const TICK_MIN_PX = 60;

const CLIP_H = 64;
const ROW_H = 20 + CLIP_H + 8;
const RULER_H = 26;

function MoveUpIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <path d="M8 12V4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M3.333 8L8 3.333L12.667 8H3.333Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}

function MoveDownIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <path d="M8 4V12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M3.333 8L8 12.667L12.667 8H3.333Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <path d="M3 3.333V13H13V3.333H3Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M6.7 6.7V10.3M9.3 6.7V10.3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M1.5 3.333H14.5M5.5 3.333L6.5 1.333H9.5L10.5 3.333H5.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );
}

function AudioMark() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <path d="M8 2.667L3.333 5.333V10.667L8 13.333L12.667 10.667V5.333L8 2.667Z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
    </svg>
  );
}

function ZoomInIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <path d="M8 3.333V12.667" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M3.333 8H12.667" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function ZoomOutIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <path d="M3.333 8H12.667" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

export default function TimelineBar() {
  const segments = useCompositionEditorStore((s) => s.segments);
  const cursor = useCompositionEditorStore((s) => s.cursor);
  const zoom = useCompositionEditorStore((s) => s.zoom);
  const selectedId = useCompositionEditorStore((s) => s.selectedId);
  const select = useCompositionEditorStore((s) => s.select);
  const seek = useCompositionEditorStore((s) => s.seek);
  const updateSegment = useCompositionEditorStore((s) => s.updateSegment);
  const moveSegment = useCompositionEditorStore((s) => s.moveSegment);
  const removeSegment = useCompositionEditorStore((s) => s.removeSegment);
  const setZoom = useCompositionEditorStore((s) => s.setZoom);

  const scrollRef = useRef(null);
  // 指针锚定：缩放后待校正的 scrollLeft，待 zoom 变更提交 DOM 后再落地
  const pendingScrollRef = useRef(null);

  const playing = useCompositionEditorStore((s) => s.playing);

  const { windows: visualWindows } = computeVisualWindows(segments);
  const { windows: audioAux } = computeAudioWindows(segments);
  // 总时长口径统一走 store 的 computeTotalDuration（V1 可视总长 / A1 最末端取大）
  const timeMax = Math.max(computeTotalDuration(segments), 0.001);
  const contentWidth = Math.max(320, Math.round(timeMax * zoom) + TRAILING_PAD);

  // Ctrl/Cmd+滚轮缩放：React 合成 onWheel 无法可靠 preventDefault（root 级 wheel
  // 监听被浏览器按 passive 处理存在行为差异），故对滚动容器手动绑非 passive 原生监听
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return undefined;
    const onWheel = (event) => {
      if (!event.ctrlKey && !event.metaKey) return; // 无修饰键：不拦截，保持原生横向滚动
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

  const dragRef = useRef(null);

  const startDrag = (e, seg, kind) => {
    e.stopPropagation();
    dragRef.current = {
      kind,
      segId: seg.id,
      startX: e.clientX,
      startVal: kind === 'offset' ? (seg.offset || 0) : (seg.duration || 0),
    };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const moveDrag = (e) => {
    const d = dragRef.current;
    if (!d) return;
    // 像素差按当前缩放（pxPerSecond）折算为秒
    const next = d.startVal + (e.clientX - d.startX) / zoom;
    updateSegment(d.segId, d.kind === 'offset' ? { offset: next } : { duration: next });
  };

  const endDrag = (e) => {
    dragRef.current = null;
    try { e.currentTarget.releasePointerCapture?.(e.pointerId); } catch { /* ignore */ }
  };

  // 缩放控件动作（setZoom 内部统一钳 4~240）
  const zoomIn = () => setZoom(zoom * ZOOM_FACTOR);
  const zoomOut = () => setZoom(zoom / ZOOM_FACTOR);
  const zoomReset = () => setZoom(ZOOM_DEFAULT);
  const zoomFit = () => {
    const container = scrollRef.current;
    if (!container) return;
    // 适应内容：可视宽（扣除尾部留白）÷ 工程总时长
    setZoom((container.clientWidth - TRAILING_PAD) / timeMax);
  };

  const clickTrack = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / contentWidth));
    seek(ratio * timeMax);
  };

  // 刻度步进自适应：满足「步进 × zoom ≥ 60px」的最小档，保证标签不重叠
  const tickStep = TICK_STEPS.find((step) => step * zoom >= TICK_MIN_PX) || TICK_STEPS[TICK_STEPS.length - 1];
  const tickMarks = [];
  const lastTick = Math.floor(timeMax / tickStep);
  for (let i = 0; i <= lastTick; i += 1) tickMarks.push(i * tickStep);

  // 游标行：绝对定位的细直线
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
    const selected = seg.id === selectedId;
    const thumb = seg.thumbnailUrl || seg.posterUrl;
    const width = Math.max(28, Math.round((win.end - win.start) * zoom));
    // 卡片信息标签：入点（仅视频/音频段且 offset > 0）与倍速（≠1），图片段不显示
    const offset = Number(seg.offset) || 0;
    const speed = Number(seg.speed);
    const inPointText = seg.type !== 'image' && offset > 0 ? ` · 入点 ${formatTime(offset)}` : '';
    const speedText = seg.type !== 'image' && Number.isFinite(speed) && speed > 0 && speed !== 1 ? ` · ${speed}x` : '';
    return (
      <div
        key={seg.id}
        onClick={() => { select(seg.id); seek(win.start); }}
        className={`group absolute top-0 overflow-hidden rounded-medium border flex flex-col justify-between px-[4px] py-[3px] cursor-pointer transition-colors ${
          selected
            ? 'bg-white-10 border-stroke-active'
            : 'bg-surface-card border-stroke-normal'
        }`}
        style={{ left: win.start * zoom, width, height: CLIP_H }}
        title={`${seg.name || '片段'} · ${formatTime(seg.duration)}${inPointText}${speedText}`}
      >
        <div className="flex items-center gap-[4px] min-w-0">
          {isAudio ? (
            <span className="shrink-0"><AudioMark /></span>
          ) : thumb ? (
            <img src={thumb} alt="" className="w-[22px] h-[16px] rounded-small object-cover shrink-0" />
          ) : null}
          <span className="truncate text-font-size-12 text-text-secondary flex-1" style={{ fontFamily: FONT }}>
            {seg.name || '片段'}
          </span>
        </div>

        <div className="flex items-center justify-between gap-[2px]">
          <span className="text-font-size-12 text-text-hint whitespace-nowrap" style={{ fontFamily: FONT }}>
            {formatTime(seg.duration)}{inPointText}{speedText}
          </span>
          <span className={`flex items-center gap-[2px] ${selected ? '' : 'hidden group-hover:flex'}`}>
            <button type="button" onClick={(e) => { e.stopPropagation(); moveSegment(seg.id, 'up'); }} className="p-[1px] text-text-hint hover:text-text-primary cursor-pointer border-0 bg-transparent">
              <MoveUpIcon />
            </button>
            <button type="button" onClick={(e) => { e.stopPropagation(); moveSegment(seg.id, 'down'); }} className="p-[1px] text-text-hint hover:text-text-primary cursor-pointer border-0 bg-transparent">
              <MoveDownIcon />
            </button>
            <button type="button" onClick={(e) => { e.stopPropagation(); removeSegment(seg.id); }} className="p-[1px] text-text-hint hover:text-text-danger cursor-pointer border-0 bg-transparent">
              <TrashIcon />
            </button>
          </span>
        </div>

        {/* 左入点手柄（图片无） */}
        {seg.type !== 'image' && (
          <div
            className="absolute left-0 top-0 bottom-0 w-[6px] cursor-ew-resize flex items-center justify-center text-text-secondary opacity-40 hover:opacity-100"
            onPointerDown={(e) => startDrag(e, seg, 'offset')}
            onPointerMove={moveDrag}
            onPointerUp={endDrag}
          >
            <span className="text-font-size-8" style={{ fontSize: 8, lineHeight: 1 }}>◄</span>
          </div>
        )}
        {/* 右时长手柄 */}
        <div
          className="absolute right-0 top-0 bottom-0 w-[6px] cursor-ew-resize flex items-center justify-center text-text-secondary opacity-40 hover:opacity-100"
          onPointerDown={(e) => startDrag(e, seg, 'duration')}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
        >
          <span className="text-font-size-8" style={{ fontSize: 8, lineHeight: 1 }}>►</span>
        </div>
      </div>
    );
  };

  return (
    <div className="relative flex h-full w-full min-h-0 flex-col bg-neutral-200">
      <TimelineToolbar />
      {/* 滚动容器：承载全部时间线内容，Ctrl/Cmd+滚轮缩放绑定其上 */}
      <div className="flex min-h-0 flex-1 overflow-y-auto">
      <div className="w-[40px] shrink-0 bg-surface-toolbar" style={{ paddingTop: RULER_H, minHeight: RULER_H + ROW_H * 2 }}>
        {['V1', 'A1'].map((track) => (
          <div key={track} className="flex items-center justify-center border-t border-stroke-normal text-font-size-12 text-text-hint" style={{ height: ROW_H, paddingTop: 12, fontFamily: FONT_MEDIUM }}>{track}</div>
        ))}
      </div>
      <div ref={scrollRef} className="min-w-0 flex-1 overflow-x-auto" style={{ minHeight: RULER_H + ROW_H * 2 + 16 }}>
        <div className="relative flex-shrink-0" style={{ width: contentWidth, minWidth: '100%', height: RULER_H + ROW_H * 2 }}>
          {/* 刻度（步进自适应，每格一个刻度 + 标签） */}
          <div className="absolute top-0 left-0 right-0" style={{ height: RULER_H, cursor: 'pointer' }} onClick={clickTrack}>
            {tickMarks.map((t) => (
              <div key={t} className="absolute top-0 flex flex-col justify-between items-start" style={{ left: t * zoom, width: tickStep * zoom, height: RULER_H }}>
                <div className="w-px h-[6px] bg-white-10" />
                <span className="text-font-size-12 text-text-hint pl-[4px]" style={{ fontFamily: FONT }}>
                  {formatTime(t)}
                </span>
              </div>
            ))}
            <span className="absolute right-0 top-0 text-font-size-12 text-text-hint" style={{ fontFamily: FONT }}>
              {formatTime(timeMax)}
            </span>
          </div>

          {/* V1 轨道 */}
          <div className="absolute top-0 left-0 right-0 border-t border-stroke-normal" style={{ top: RULER_H, height: ROW_H }}>
            <div className="h-[20px]" />
            <div className="relative"
              style={{ height: ROW_H - 20 }}
              onClick={clickTrack}>
              {visualWindows.map((w) => renderCard(w, false))}
            </div>
          </div>

          {/* A1 轨道 */}
          <div className="absolute left-0 right-0 border-t border-stroke-normal" style={{ top: RULER_H + ROW_H, height: ROW_H }}>
            <div className="h-[20px]" />
            <div className="relative" style={{ height: ROW_H - 20 }} onClick={clickTrack}>
              {audioAux.map((w) => renderCard(w, true))}
            </div>
          </div>

          {/* 游标线 */}
          <div className="absolute top-0 bottom-0 w-px bg-brand-main pointer-events-none" style={{ left: playheadLeft }} />
        </div>
      </div>

      {/* 缩放控件：固定在 V1 标签行右端，不随横向滚动 */}
      </div>
      <div className="absolute flex items-center gap-[2px] pr-[8px]" style={{ top: 40 + RULER_H, right: 0, height: 20 }}>
        <button type="button" onClick={zoomOut} disabled={zoom <= ZOOM_MIN} title="缩小" className="p-[1px] text-text-hint hover:text-text-primary cursor-pointer border-0 bg-transparent disabled:text-text-disabled disabled:cursor-not-allowed">
          <ZoomOutIcon />
        </button>
        <button type="button" onClick={zoomIn} disabled={zoom >= ZOOM_MAX} title="放大" className="p-[1px] text-text-hint hover:text-text-primary cursor-pointer border-0 bg-transparent disabled:text-text-disabled disabled:cursor-not-allowed">
          <ZoomInIcon />
        </button>
        <button type="button" onClick={zoomReset} className="px-[2px] text-font-size-12 text-text-hint hover:text-text-primary cursor-pointer border-0 bg-transparent" style={{ fontFamily: FONT }}>
          重置
        </button>
        <button type="button" onClick={zoomFit} className="px-[2px] text-font-size-12 text-text-hint hover:text-text-primary cursor-pointer border-0 bg-transparent" style={{ fontFamily: FONT }}>
          适应
        </button>
      </div>
    </div>
  );
}
