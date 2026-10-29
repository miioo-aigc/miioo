import { useEffect, useState } from 'react';
import VideoPlayerBar from './VideoPlayerBar';

/** 将单视频媒体事件接入共享控制栏；播放恢复、下载仍由宿主负责。 */
export default function MediaVideoPlayerBar({ videoRef, src, onToggle, displayScale = 1 }) {
  const [state, setState] = useState({ src: null, playing: false, currentTime: 0, duration: 0, volume: 1, muted: false });
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return undefined;
    let disposed = false;
    const sync = () => { if (disposed) return; setState({ src, playing: !video.paused && !video.ended, currentTime: video.currentTime,
      duration: Number.isFinite(video.duration) ? video.duration : 0, volume: video.volume, muted: video.muted }); };
    const events = ['loadedmetadata', 'durationchange', 'timeupdate', 'play', 'pause', 'ended', 'volumechange', 'emptied'];
    events.forEach(name => video.addEventListener(name, sync));
    queueMicrotask(sync);
    return () => { disposed = true; events.forEach(name => video.removeEventListener(name, sync)); };
  }, [videoRef, src]);
  const current = state.src === src ? state : { playing: false, currentTime: 0, duration: 0, volume: 1, muted: false };
  const toggle = () => {
    const video = videoRef.current;
    if (!video) return;
    if (onToggle) onToggle();
    else if (video.paused) void video.play().catch(() => {});
    else video.pause();
  };
  return <VideoPlayerBar {...current} displayScale={displayScale} disabled={!src} onToggle={toggle}
    onSeek={time => { if (videoRef.current && current.duration > 0) videoRef.current.currentTime = Math.max(0, Math.min(time, current.duration)); }}
    onVolumeChange={volume => { if (videoRef.current) videoRef.current.volume = volume; }}
    onMutedChange={muted => { if (videoRef.current) videoRef.current.muted = muted; }}
    />;
}
