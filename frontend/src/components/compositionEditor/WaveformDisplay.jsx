import { waveformPoints } from '../../utils/CompositionWaveform';
const LABELS = { pending: '波形生成中…', failed: '波形不可用', missing_source: '源文件缺失', no_audio: '无音轨', unsupported: '不支持波形', timeout: '波形生成超时' };
export default function WaveformDisplay({ segment, waveform, onRetry, trackSettings }) {
  const status = waveform?.status || (segment.assetId ? 'pending' : 'missing_source');
  const points = waveformPoints(segment, waveform, trackSettings);
  if (status === 'ready' && points) return <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none h-full w-full" role="img" aria-label="音频波形">
    {segment.type === 'audio' ? <>
      <polygon points={waveformPoints(segment, waveform, trackSettings, 'danger')} fill="var(--color-red-300)" />
      <polygon points={waveformPoints(segment, waveform, trackSettings, 'warning')} fill="var(--color-yellow-300)" />
      <polygon points={waveformPoints(segment, waveform, trackSettings, 'normal')} fill="currentColor" />
    </> : <polygon points={points} fill="currentColor" />}
  </svg>;
  const retryable = ['failed', 'missing_source', 'timeout'].includes(status) && segment.assetId;
  return <div className="flex h-full min-w-0 items-center gap-[4px] overflow-hidden text-[10px] text-text-hint">
    <span className="truncate" role="status">{LABELS[status] || '波形不可用'}</span>
    {retryable && <button type="button" className="shrink-0 cursor-pointer text-white-80" aria-label="重试生成波形"
      onPointerDown={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}
      onClick={(e) => { e.stopPropagation(); onRetry(segment.assetId); }}>重试</button>}
  </div>;
}
