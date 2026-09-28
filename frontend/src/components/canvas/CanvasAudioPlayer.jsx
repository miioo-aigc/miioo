/** 音频卡片展示：原生音频播放，柱条由当前播放片段的真实采样驱动。 */
import { useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { useCanvasAudioWaveform } from './UseCanvasAudioWaveform';
import CreationDubbingPromptPreview from '../creation/CreationDubbingPromptPreview';

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '--:--:--';
  const value = Math.floor(seconds);
  return [Math.floor(value / 3600), Math.floor(value / 60) % 60, value % 60].map((part) => String(part).padStart(2, '0')).join(':');
}

export default function CanvasAudioPlayer({ url, name, transcript }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(NaN);
  const [error, setError] = useState(false);
  const { waveformRef, active } = useCanvasAudioWaveform({ url, playing, audioRef });

  async function togglePlayback(event) {
    event.stopPropagation();
    const audio = audioRef.current;
    if (!audio) return;
    if (!audio.paused) { audio.pause(); return; }
    setError(false);
    try { await audio.play(); } catch { setError(true); }
  }

  return <div className={`canvas-node__audio ${transcript ? 'canvas-node__audio--transcript' : ''}`}>
    {url && <audio ref={audioRef} src={url} preload="metadata" aria-label={name || '音频预览'}
      onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
      onDurationChange={(event) => setDuration(event.currentTarget.duration)}
      onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
      onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)}
      onError={() => { setError(true); setPlaying(false); }} />}
    <div className="canvas-node__audio-controls">
      <button type="button" className="canvas-node__play nodrag nopan" onClick={togglePlayback} disabled={!url} aria-label={playing ? '暂停' : '播放'} title={playing ? '暂停' : '播放'}>
        {playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
      </button>
      <span className="canvas-node__audio-time">{error ? <span role="alert">音频无法播放</span> : `${formatTime(currentTime)}/${formatTime(duration)}`}</span>
    </div>
    {transcript && <div className="canvas-node__transcript nodrag nopan nowheel">
      <CreationDubbingPromptPreview prompt={transcript} style={{ color: 'inherit', fontSize: 'inherit', lineHeight: 'inherit' }} />
    </div>}
    <div ref={waveformRef} className="canvas-node__waveform" data-active={active} aria-hidden="true">
      {Array.from({ length: 51 }, (_, index) => <i key={index} style={{ height: '3px' }} />)}
    </div>
  </div>;
}
