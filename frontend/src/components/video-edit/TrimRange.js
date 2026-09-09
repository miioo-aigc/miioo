export function durationTicks(seconds) {
  return Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds * 10 + 1e-7)) : 0;
}

export function formatTrimTime(ticks) {
  const total = Math.max(0, Math.round(ticks));
  return `${String(Math.floor(total / 36000)).padStart(2, '0')}:${String(Math.floor(total / 600) % 60).padStart(2, '0')}:${String(Math.floor(total / 10) % 60).padStart(2, '0')}.${total % 10}`;
}

export function parseTrimTime(text) {
  const match = /^(\d+):([0-5]\d):([0-5]\d)\.(\d)$/.exec(text.trim());
  if (!match) return null;
  const value = Number(match[1]) * 36000 + Number(match[2]) * 600 + Number(match[3]) * 10 + Number(match[4]);
  return Number.isSafeInteger(value) ? value : null;
}

export function updateTrimRange(range, edge, value, total) {
  if (total < 1 || !Number.isFinite(value)) return range;
  const tick = Math.round(value);
  return edge === 'start'
    ? { start: Math.max(0, Math.min(tick, range.end - 1)), end: range.end }
    : { start: range.start, end: Math.min(total, Math.max(range.start + 1, tick)) };
}
