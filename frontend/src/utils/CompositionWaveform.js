/** 以源时间截取峰值桶，保留桶在片段内的实际位置；静音不制造最低振幅。 */
export function waveformPoints(segment, waveform) {
  if (waveform?.status !== 'ready' || !waveform.peaks?.length || !(waveform.duration > 0)) return '';
  const start = Math.max(0, Number(segment.offset) || 0);
  const speed = Number(segment.speed) > 0 ? Number(segment.speed) : 1;
  const length = Number(segment.duration) * speed;
  if (!Number.isFinite(length) || length <= 0) return '';
  const end = Math.min(start + length, waveform.duration);
  if (start >= end) return '';
  const step = waveform.duration / waveform.peaks.length;
  const points = ['0,100'];
  const first = Math.floor(start / step);
  const last = Math.min(waveform.peaks.length, Math.ceil(end / step));
  for (let i = first; i < last; i++) {
    const left = Math.max(start, i * step);
    const right = Math.min(end, (i + 1) * step);
    const y = 100 - waveform.peaks[i] * 100;
    points.push(((left - start) / length * 100) + ',' + y, ((right - start) / length * 100) + ',' + y);
  }
  points.push(((end - start) / length * 100) + ',100', '100,100');
  return points.join(' ');
}
