import useVideoThumbnails from './useVideoThumbnails';
import './VideoTrim.css';

export default function VideoFrameTimeline({ videoUrl, start, end, time, index, disabled, onSeek }) {
  const { frames, failed } = useVideoThumbnails(videoUrl, end * 10);
  const percent = end > start ? (time - start) / (end - start) * 100 : 0;
  return <div className="trim-timeline frame-timeline">
    <div className="trim-frames" aria-hidden="true">
      {frames.map((src, frame) => <img key={frame} src={src} alt="" draggable={false} />)}
    </div>
    {!frames.length && <span className="trim-frame-status" role="status">{failed ? '缩略帧不可用' : disabled ? '等待视频加载' : '正在加载缩略帧'}</span>}
    <div className="trim-playhead frame-playhead" style={{ left: `calc(1px + (100% - 2px) * ${percent / 100})` }} />
    <input className="frame-timeline-input" type="range" aria-label="选帧时间轴"
      aria-valuetext={`第 ${index + 1} 帧，${(time - start).toFixed(3)} 秒`}
      min={start} max={end > start ? end : start + 1} step="any" value={time} disabled={disabled}
      onChange={(event) => onSeek(Number(event.target.value))} />
  </div>;
}
