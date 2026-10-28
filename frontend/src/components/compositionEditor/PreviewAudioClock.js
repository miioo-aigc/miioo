export const AUDIO_STALL_EPSILON = 1e-4;
export const AUDIO_BACKWARD_TOLERANCE = 0.05;
export const AUDIO_FORWARD_JUMP = 0.5;
export const AUDIO_JUMP_STEP = 0.25;

export function speedOf(seg) {
  if (seg?.type === 'image') return 1;
  const speed = Number(seg?.speed);
  return Number.isFinite(speed) && speed > 0 ? speed : 1;
}
export function audioTargetTime({ seg, windowStart, cursor }) {
  return Math.max(0, (Number(seg.offset) || 0) + (cursor - windowStart) * speedOf(seg));
}
export function audioTimelineTime({ seg, windowStart, mediaTime }) {
  return windowStart + (mediaTime - (Number(seg.offset) || 0)) / speedOf(seg);
}
export function pickActiveAudioWindow(windows, cursor) {
  return windows.find((window) => cursor >= window.start && cursor < window.end) ?? null;
}
export function adoptAudioCursor({ prevCursor: prev, prevMediaTime: last, mediaTime: media, seg, windowStart, dt }) {
  const wallNext = prev + Math.max(0, dt);
  if (!Number.isFinite(media)) return { next: wallNext, resyncTo: null };
  const audioNext = audioTimelineTime({ seg, windowStart, mediaTime: media });
  if (!Number.isFinite(audioNext)) return { next: wallNext, resyncTo: null };
  // 回退必须先于停顿判定，避免媒体从 3 秒退至 1 秒时漏掉纠偏。
  if (audioNext < prev - AUDIO_BACKWARD_TOLERANCE) {
    return { next: wallNext, resyncTo: audioTargetTime({ seg, windowStart, cursor: prev }) };
  }
  if (Number.isFinite(last) && media <= last + AUDIO_STALL_EPSILON) {
    return { next: wallNext, resyncTo: null };
  }
  if (audioNext > prev + AUDIO_FORWARD_JUMP) {
    const next = prev + AUDIO_JUMP_STEP;
    return { next, resyncTo: audioTargetTime({ seg, windowStart, cursor: next }) };
  }
  return { next: Math.max(0, audioNext), resyncTo: null };
}
