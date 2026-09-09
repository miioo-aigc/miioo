import { useEffect, useRef, useState } from 'react';
import { Pause, Play, Volume2, VolumeX } from 'lucide-react';
import ImageEditChrome from '../image-edit/ImageEditChrome';
import Button from '../ui/Button';
import SubtitleMask from './SubtitleMask';
import { DEFAULT_SUBTITLE_MASK } from './SubtitleMaskGeometry';
import { showGlobalToast } from '../../stores/toastStore';
import './VideoSubtitle.css';

function formatTime(seconds) {
  const safe = Number.isFinite(seconds) ? Math.floor(seconds) : 0;
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`;
}

export default function VideoSubtitleModal({ videoUrl, posterUrl = '', onClose }) {
  const videoRef = useRef(null);
  const stageRef = useRef(null);
  const frameRef = useRef(null);
  const [mask, setMask] = useState(DEFAULT_SUBTITLE_MASK);
  const [source, setSource] = useState({ width: 0, height: 0 });
  const [area, setArea] = useState({ width: 0, height: 0 });
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const available = Boolean(videoUrl && ready && !failed && source.width && source.height);
  const scale = source.width && source.height ? Math.min(area.width / source.width, area.height / source.height) : 0;

  useEffect(() => {
    const stage = stageRef.current;
    const measure = () => setArea({ width: stage.clientWidth, height: stage.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  function togglePlay() {
    const video = videoRef.current;
    if (!video || !available) return;
    if (video.paused) video.play().catch(() => setPlaying(false));
    else video.pause();
  }

  function close() {
    videoRef.current?.pause();
    onClose();
  }

  function submit() {
    if (!available) return;
    showGlobalToast('字幕处理区域已准备完成，生成服务暂未接入', 'info');
    close();
  }

  return <ImageEditChrome title="去字幕" onClose={close} zIndex={1400} footer={
    <footer className="subtitle-footer">
      <Button variant="secondary" size="large" onClick={close}>取消</Button>
      <Button variant="primary" size="large" onClick={submit} disabled={!available}>AI生成</Button>
    </footer>
  }>
    <div className="subtitle-body">
      <div ref={stageRef} className="subtitle-stage">
        {videoUrl && !failed ? <div ref={frameRef} className="subtitle-frame" style={{ width: scale ? source.width * scale : '100%', height: scale ? source.height * scale : '100%' }}>
          <video ref={videoRef} src={videoUrl} poster={posterUrl || undefined} autoPlay muted={muted} playsInline preload="auto"
            onLoadedMetadata={(event) => {
              const video = event.currentTarget;
              setSource({ width: video.videoWidth, height: video.videoHeight });
              setDuration(Number.isFinite(video.duration) ? video.duration : 0);
            }}
            onLoadedData={() => setReady(true)} onError={() => { setFailed(true); setPlaying(false); }}
            onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)}
            onTimeUpdate={(event) => setTime(event.currentTarget.currentTime)}
          />
          {available && <>
            <button type="button" className="subtitle-play-surface" aria-label={playing ? '暂停视频画面' : '播放视频画面'} onClick={togglePlay} />
            <SubtitleMask value={mask} onChange={setMask} frameRef={frameRef} />
          </>}
        </div> : <span role="status">视频加载失败，请关闭后重试</span>}
      </div>
      <div className="subtitle-playback">
        <button type="button" aria-label={playing ? '暂停视频' : '播放视频'} title={playing ? '暂停视频' : '播放视频'} disabled={!available} onClick={togglePlay}>{playing ? <Pause size={16} /> : <Play size={16} />}</button>
        <span>{formatTime(time)} / {formatTime(duration)}</span>
        <input type="range" aria-label="视频播放进度" min="0" max={duration || 1} step="0.01" value={Math.min(time, duration || 1)} disabled={!available || !duration} onChange={(event) => { const next = Number(event.target.value); videoRef.current.currentTime = next; setTime(next); }} />
        <button type="button" aria-label={muted ? '取消静音' : '静音'} title={muted ? '取消静音' : '静音'} disabled={!available} onClick={() => setMuted(!muted)}>{muted ? <VolumeX size={16} /> : <Volume2 size={16} />}</button>
      </div>
    </div>
  </ImageEditChrome>;
}
