/** 视频详情与成片预览共用双排控制栏，宿主提供播放状态及可用能力。 */
import { Pause, Play, Volume2, VolumeX } from 'lucide-react';
import IconButton from './IconButton';
import './VideoPlayerBar.css';

function playerTime(value) {
  const seconds = Math.max(0, Math.floor(Number.isFinite(value) ? value : 0));
  return [Math.floor(seconds / 60), String(seconds % 60).padStart(2, '0')].join(':');
}

export default function VideoPlayerBar({ displayScale = 1, playing, currentTime = 0, duration = 0, volume = 1, muted = false,
  trailingControl, onToggle, onToggleKeyDown, onSeek, onVolumeChange, onMutedChange, disabled = false }) {
  const silent = muted || volume === 0;
  const toggleMuted = () => {
    if (silent && volume === 0) onVolumeChange(1);
    onMutedChange(!silent);
  };
  const position = Math.max(0, Math.min(currentTime, duration || 0));
  return <div className="video-player-bar" style={{ '--video-control-scale': displayScale > 0 ? displayScale : 1 }} role="group" aria-label="视频播放控制"
    onClick={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()}>
    <div className="video-player-actions">
      <IconButton className="video-player-button video-player-toggle" variant="link" aria-label={playing ? '暂停视频' : '播放视频'} title={playing ? '暂停视频' : '播放视频'} disabled={disabled} onClick={onToggle} onKeyDown={onToggleKeyDown}>
        {playing ? <Pause size={20} fill="currentColor" strokeWidth={0} /> : <Play size={20} fill="currentColor" strokeWidth={0} />}
      </IconButton>
      <span className="video-player-time">{playerTime(position)} / {playerTime(duration)}</span>
      <div className="video-player-volume-group">
        <input className="video-player-range video-player-volume" type="range" min={0} max={1} step={0.01} value={muted ? 0 : volume}
          style={{ '--video-progress': (muted ? 0 : volume) * 100 + '%' }} disabled={disabled} aria-label="播放音量" onChange={event => { onVolumeChange(Number(event.target.value)); onMutedChange(false); }} />
        <IconButton className="video-player-button video-player-volume-button" variant="link" aria-label={silent ? '取消静音' : '静音'} title={silent ? '取消静音' : '静音'} disabled={disabled} onClick={toggleMuted}>
          {muted || volume === 0 ? <VolumeX size={22} fill="currentColor" /> : <Volume2 size={22} fill="currentColor" />}
        </IconButton>
      </div>
      {trailingControl}
    </div>
    <input className="video-player-range video-player-seek" type="range" min={0} max={duration || 1} step={0.01}
      style={{ '--video-progress': duration > 0 ? position / duration * 100 + '%' : '0%' }}
      value={position} disabled={disabled} aria-label="播放进度" aria-valuetext={playerTime(position)}
      onChange={event => onSeek(Number(event.target.value))} />
  </div>;
}
