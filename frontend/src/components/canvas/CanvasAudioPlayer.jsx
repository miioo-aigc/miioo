/** 音频卡片展示：原生音频播放，柱条由当前播放片段的真实采样驱动。 */
import { useRef, useState } from 'react';
import { useMediaPlayback } from '../../hooks/useMediaPlayback';
import { LoaderCircle, Pause, Play, RotateCw } from 'lucide-react';
import { useCanvasAudioWaveform } from './UseCanvasAudioWaveform';
import CreationDubbingPromptPreview from '../creation/CreationDubbingPromptPreview';

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '--:--:--';
  const value = Math.floor(seconds);
  return [Math.floor(value / 3600), Math.floor(value / 60) % 60, value % 60].map((part) => String(part).padStart(2, '0')).join(':');
}

/** 只显示总时长：不足一小时用 mm:ss，超过一小时用 h:mm:ss，元数据未就绪用 --:--。 */
function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '--:--';
  const value = Math.floor(seconds);
  const minutes = Math.floor(value / 60);
  const rest = value % 60;
  if (minutes >= 60) return [Math.floor(minutes / 60), minutes % 60, rest].map((part) => String(part).padStart(2, '0')).join(':');
  return String(minutes).padStart(2, '0') + ':' + String(rest).padStart(2, '0');
}

export default function CanvasAudioPlayer({ url, name, transcript, compact = false, timeMode = 'progress', onReady, onError }) {
  const audioRef = useRef(null);
  const media = useMediaPlayback(audioRef, url, { timeoutRetries: 3 });
  const playing = media.status === 'playing';
  const loading = media.status === 'loading';
  const failed = media.status === 'error';
  const actionLabel = failed ? '重新加载音频' : loading ? '正在加载，点击取消等待' : playing ? '暂停' : '播放';
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(NaN);

  const { waveformRef, active } = useCanvasAudioWaveform({ url, playing, audioRef });

  async function togglePlayback(event) {
    event.stopPropagation();
    if (failed) media.retry();
    else if (playing || loading) media.pause();
    else void media.play();
  }

  return <div className={`canvas-node__audio ${transcript ? 'canvas-node__audio--transcript' : ''} ${compact ? 'canvas-node__audio--compact' : ''}`}>
    {url && <audio ref={audioRef} src={url} preload="metadata" aria-label={name || '音频预览'}
      onLoadedMetadata={(event) => { setDuration(event.currentTarget.duration); onReady?.(); }}
      onError={onError}
      onDurationChange={(event) => setDuration(event.currentTarget.duration)}
      onTimeUpdate={(event) => { if (timeMode !== 'duration') setCurrentTime(event.currentTarget.currentTime); }}
 />}
    <div className="canvas-node__audio-controls">
      <button type="button" className="canvas-node__play nodrag nopan" onClick={togglePlayback} disabled={!url} aria-label={actionLabel} title={actionLabel}>
        {loading ? <LoaderCircle size={16} className="animate-spin" /> : failed ? <RotateCw size={16} /> : playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
      </button>
      <span className="canvas-node__audio-time">{ timeMode === 'duration' ? formatDuration(duration) : `${formatTime(currentTime)}/${formatTime(duration)}` }</span>
    </div>
    {transcript && <div className="canvas-node__transcript nodrag nopan nowheel">
      <CreationDubbingPromptPreview prompt={transcript} style={{ color: 'inherit', fontSize: 'inherit', lineHeight: 'inherit' }} />
    </div>}
    <div ref={waveformRef} className="canvas-node__waveform" data-active={active} aria-hidden="true">
      {Array.from({ length: 51 }, (_, index) => <i key={index} style={{ height: '3px' }} />)}
    </div>
  </div>;
}
