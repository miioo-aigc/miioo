export const DEFAULT_SUBTITLE_MASK = { x: 0, y: 0.88, width: 1, height: 0.12 };

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function resizeSubtitleMask(start, direction, dx, dy, minimum = { width: 0.02, height: 0.02 }) {
  let left = start.x;
  let top = start.y;
  let right = start.x + start.width;
  let bottom = start.y + start.height;
  if (direction.includes('w')) left = clamp(left + dx, 0, right - minimum.width);
  if (direction.includes('e')) right = clamp(right + dx, left + minimum.width, 1);
  if (direction.includes('n')) top = clamp(top + dy, 0, bottom - minimum.height);
  if (direction.includes('s')) bottom = clamp(bottom + dy, top + minimum.height, 1);
  return { x: left, y: top, width: right - left, height: bottom - top };
}
