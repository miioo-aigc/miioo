import { useRef } from 'react';
import { formatTrimTime } from './TrimRange';
import useVideoThumbnails from './useVideoThumbnails';

export default function VideoTrimTimeline({ videoUrl, total, range, zoom, time, disabled, onChange, onSeek }) {
  const trackRef = useRef(null);
  const drag = useRef(null);
  const { frames, failed } = useVideoThumbnails(videoUrl, total);
  const percent = (tick) => total ? tick / total * 100 : 0;
  function position(event) {
    const rect = trackRef.current.getBoundingClientRect();
    return Math.max(0, Math.min(total, (event.clientX - rect.left) / rect.width * total));
  }
  return <div className="trim-timeline-scroll">
    <div ref={trackRef} className="trim-timeline" style={{ width: `${zoom * 100}%` }}
      onClick={(event) => { if (!disabled && !event.target.closest('button')) onSeek(position(event) / 10); }}>
      <div className="trim-frames" aria-hidden="true">
        {frames.map((src, index) => <img key={index} src={src} alt="" draggable={false} />)}
      </div>
      {!frames.length && <span className="trim-frame-status" role="status">{failed ? '缩略帧不可用' : disabled ? '等待视频加载' : '正在加载缩略帧'}</span>}
      <div className="trim-dim" style={{ left: 0, width: `${percent(range.start)}%` }} />
      <div className="trim-dim" style={{ right: 0, width: `${100 - percent(range.end)}%` }} />
      {!disabled && <>
        <div className="trim-selection" style={{ left: `${percent(range.start)}%`, width: `${percent(range.end - range.start)}%` }} />
        <div className="trim-playhead" style={{ left: `${percent(time * 10)}%` }} />
        {['start', 'end'].map((edge) => <button key={edge} type="button" role="slider" className={`trim-handle trim-handle-${edge}`}
          aria-label={edge === 'start' ? '剪辑起点' : '剪辑终点'} aria-valuemin={edge === 'start' ? 0 : (range.start + 1) / 10}
          aria-valuemax={edge === 'start' ? (range.end - 1) / 10 : total / 10} aria-valuenow={range[edge] / 10} aria-valuetext={formatTrimTime(range[edge])}
          style={{ left: `${percent(range[edge])}%` }}
          onPointerDown={(event) => { event.preventDefault(); drag.current = edge; event.currentTarget.setPointerCapture(event.pointerId); }}
          onPointerMove={(event) => { if (drag.current === edge) onChange(edge, position(event)); }}
          onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onLostPointerCapture={() => { drag.current = null; }}
          onKeyDown={(event) => {
            const delta = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 }[event.key];
            if (delta) { event.preventDefault(); onChange(edge, range[edge] + delta); }
            if (event.key === 'Home' || event.key === 'End') { event.preventDefault(); onChange(edge, event.key === 'Home' ? 0 : total); }
          }}><span /></button>)}
      </>}
    </div>
  </div>;
}
