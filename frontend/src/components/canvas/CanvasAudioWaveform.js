/** 5ms RMS 包络；声道分别求能量，避免反相抵消。 */
export function buildAudioLevels(buffer) {
  const blockSize = Math.max(1, Math.round(buffer.sampleRate * 0.005));
  const levels = new Float32Array(Math.ceil(buffer.length / blockSize));
  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const samples = buffer.getChannelData(channel);
    for (let block = 0; block < levels.length; block += 1) {
      const start = block * blockSize;
      const end = Math.min(start + blockSize, samples.length);
      let energy = 0;
      for (let sample = start; sample < end; sample += 1) energy += samples[sample] ** 2;
      levels[block] += energy / (end - start) / buffer.numberOfChannels;
    }
  }
  for (let index = 0; index < levels.length; index += 1) levels[index] = Math.sqrt(levels[index]);
  return { levels, step: blockSize / buffer.sampleRate, duration: buffer.length / buffer.sampleRate };
}

/** 当前时刻之前约 250ms 的真实声音，不把横轴当作整段音频进度。 */
export function getAudioBars(analysis, time, count = 51) {
  if (!analysis || !Number.isFinite(time) || time < 0 || time >= analysis.duration) return Array(count).fill(3);
  const current = Math.floor(time / analysis.step);
  return Array.from({ length: count }, (_, index) => {
    const amplitude = analysis.levels[current - count + 1 + index] || 0;
    return 3 + 17 * Math.sqrt(Math.min(1, amplitude * 3));
  });
}
