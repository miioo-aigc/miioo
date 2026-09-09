import { useEffect, useRef, useState } from 'react';
import VideoPlaybackControls from '../ui/VideoPlaybackControls';
import ImageEditChrome, { ImageEditFooter } from '../image-edit/ImageEditChrome';
import VideoTrimTimeline from './VideoTrimTimeline';
import VideoTrimFields from './VideoTrimFields';
import { durationTicks, updateTrimRange } from './TrimRange';
import { showGlobalToast } from '../../stores/toastStore';
import './VideoTrim.css';

export default function VideoTrimModal({ videoUrl, posterUrl = '', onClose }) {
  const videoRef = useRef(null);
  const [range, setRange] = useState({ start: 0, end: 0 });
  const [total, setTotal] = useState(0);
  const [time, setTime] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const feedbackTimerRef = useRef(null);
  const available = Boolean(videoUrl && ready && total > 0 && !failed);

  useEffect(() => {
    if (!playing) return undefined;
    let frame;
    const tick = () => {
      const video = videoRef.current;
      if (video.currentTime >= range.end / 10) {
        video.pause();
        video.currentTime = range.end / 10;
      }
      setTime(video.currentTime);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, range.end]);

  function seek(seconds) {
    if (!available) return;
    const next = Math.max(range.start / 10, Math.min(range.end / 10, seconds));
    videoRef.current.currentTime = next;
    setTime(next);
  }

  function change(edge, value) {
    const next = updateTrimRange(range, edge, value, total);
    setRange(next);
    videoRef.current?.pause();
    if (videoRef.current) {
      const seconds = next[edge] / 10;
      videoRef.current.currentTime = seconds;
      setTime(seconds);
    }
  }

  function togglePlay() {
    const video = videoRef.current;
    if (!available) return;
    if (!video.paused) { video.pause(); showFeedback(); return; }
    if (video.currentTime >= range.end / 10 || video.currentTime < range.start / 10) seek(range.start / 10);
    video.play().then(showFeedback).catch(() => showGlobalToast('播放失败，请重试', 'error'));
  }

  function showFeedback() {
    setFeedbackVisible(true);
    clearTimeout(feedbackTimerRef.current);
    feedbackTimerRef.current = setTimeout(() => setFeedbackVisible(false), 500);
  }

  function reset() {
    videoRef.current?.pause();
    setRange({ start: 0, end: total });
    setZoom(1);
    setTime(0);
    if (videoRef.current && ready) videoRef.current.currentTime = 0;
  }

  function close() { videoRef.current?.pause(); onClose(); }
  function save() {
    if (!available) return;
    showGlobalToast('剪辑服务暂未接入，尚未生成或保存新视频', 'info');
    close();
  }

  return <ImageEditChrome title="视频剪辑" onClose={close} zIndex={1400}
    footer={<ImageEditFooter onReset={reset} onClose={close} onSubmit={save} disabled={!available} />}>
    <div className="trim-body">
      <div className="trim-stage">
        {videoUrl && !failed ? <><video ref={videoRef} src={videoUrl} poster={posterUrl || undefined} playsInline preload="auto" controls
          onLoadedMetadata={(event) => {
            const ticks = durationTicks(event.currentTarget.duration);
            setTotal(ticks);
            setRange({ start: 0, end: ticks });
            if (!ticks) setFailed(true);
          }} onLoadedData={() => setReady(true)} onError={() => { setFailed(true); setPlaying(false); }}
          onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)}
          onTimeUpdate={(event) => {
            if (event.currentTarget.currentTime > range.end / 10 && total) {
              event.currentTarget.pause();
              event.currentTarget.currentTime = range.end / 10;
            }
            setTime(event.currentTarget.currentTime);
          }} /><VideoPlaybackControls isPlaying={playing} feedbackVisible={feedbackVisible} onToggle={togglePlay} /></> : <span role="status">视频无法加载或时长不足0.1秒</span>}
      </div>
      <div className="trim-editor">
        <VideoTrimTimeline videoUrl={videoUrl} total={total} range={range} zoom={zoom} time={time} disabled={!available} onChange={change} onSeek={seek} />
        <VideoTrimFields range={range} total={total} zoom={zoom} disabled={!available} onZoom={setZoom} onChange={change} />
      </div>
    </div>
  </ImageEditChrome>;
}
