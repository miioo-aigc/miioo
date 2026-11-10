import { Pause, Play } from 'lucide-react';
import VideoCircleBadge from './VideoCircleBadge';

export default function VideoPlaybackControls({ isPlaying, feedbackVisible, onToggle, onToggleKeyDown, bottomInset = 48 }) {
  return <>
    <button
      type="button"
      aria-label={isPlaying ? '暂停视频' : '播放视频'}
      title={isPlaying ? '暂停视频' : '播放视频'}
      style={{ position: 'absolute', inset: 0, bottom: bottomInset, cursor: 'pointer', padding: '0 24px', border: 0, background: 'transparent' }}
      onClick={onToggle}
      onKeyDown={onToggleKeyDown}
    />
    {feedbackVisible && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }} aria-hidden="true">
      <VideoCircleBadge size={56}>{isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}</VideoCircleBadge>
    </div>}
  </>;
}
