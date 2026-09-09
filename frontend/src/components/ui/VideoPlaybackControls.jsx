import { Pause, Play } from 'lucide-react';

export default function VideoPlaybackControls({ isPlaying, feedbackVisible, onToggle }) {
  return <>
    <button
      type="button"
      aria-label={isPlaying ? '暂停视频' : '播放视频'}
      title={isPlaying ? '暂停视频' : '播放视频'}
      style={{ position: 'absolute', inset: '0 0 48px', cursor: 'pointer', padding: '0 24px', border: 0, background: 'transparent' }}
      onClick={onToggle}
    />
    {feedbackVisible && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }} aria-hidden="true">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '56px', height: '56px', borderRadius: '50%', backdropFilter: 'blur(8px)', background: '#FFFFFF1F', border: '1px solid #FFFFFF33', color: '#FFFFFF' }}>
        {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
      </div>
    </div>}
  </>;
}
