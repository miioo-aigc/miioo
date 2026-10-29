/** 以源时间截取峰值桶，保留桶在片段内的实际位置；静音不制造最低振幅。 */
export function waveformPoints(segment, waveform, trackSettings = {}, level) {
  if (waveform?.status !== 'ready' || !waveform.peaks?.length || !(waveform.duration > 0)) return '';
  const start = Math.max(0, Number(segment.offset) || 0);
  const speed = Number(segment.speed) > 0 ? Number(segment.speed) : 1;
  const length = Number(segment.duration) * speed;
  if (!Number.isFinite(length) || length <= 0) return '';
  const end = Math.min(start + length, waveform.duration);
  if (start >= end) return '';
  const step = waveform.duration / waveform.peaks.length;
  const points = ['0,100'];
  const volume = Number(segment.volume ?? 1) * Number(trackSettings.volume ?? 1);
  const gain = trackSettings.hidden ? 0 : Number.isFinite(volume) ? Math.max(0, Math.min(2, volume)) : 1;
  const first = Math.floor(start / step);
  const last = Math.min(waveform.peaks.length, Math.ceil(end / step));
  for (let i = first; i < last; i++) {
    const left = Math.max(start, i * step);
    const right = Math.min(end, (i + 1) * step);
    const amplitude = waveform.peaks[i] * gain;
    // 分层由红到蓝覆盖：每层仅画到其上限，保留同一峰值下方的蓝色主体。
    // 所有音频共用连续对数显示标尺，增强低幅度可读性；0仍为0，不按素材归一化。
    // −6 dBFS 是产品预警线；采样峰值不等于真实峰值或整体响度。
    const ceiling = level === 'normal' ? 10 ** (-6 / 20) : level === 'warning' ? 1 : level === 'danger' ? 2 : 1;
    const clipped = Math.min(ceiling, amplitude);
    const height = level ? Math.log1p(1000 * clipped) / Math.log1p(2000) * 100 : clipped * 100;
    const y = 100 - height;
    points.push(((left - start) / length * 100) + ',' + y, ((right - start) / length * 100) + ',' + y);
  }
  points.push(((end - start) / length * 100) + ',100', '100,100');
  return points.join(' ');
}
