/** 构图以成片画布归一化，不依赖预览分辨率和编辑视图倍率。 */
export const coverTransform = () => ({ version: 1, mode: 'cover' });
export function canvasRatio(value) {
  const [w, h] = String(value).split(':').map(Number);
  return w > 0 && h > 0 ? w / h : 16 / 9;
}
export function displayRatio(source) {
  const ratio = source?.display_aspect_ratio;
  return ratio?.num > 0 && ratio?.den > 0 ? ratio.num / ratio.den : null;
}
export function transformRect(transform, ratio, cw, ch) {
  if (!(ratio > 0)) return null;
  if (transform?.mode === 'manual') {
    const { center_x: x, center_y: y, width, height } = transform;
    if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return null;
    return { x: (x - width / 2) * cw, y: (y - height / 2) * ch, width: width * cw, height: height * ch };
  }
  const height = (transform?.mode === 'cover' ? Math.max : Math.min)(ch, cw / ratio);
  return { x: (cw - height * ratio) / 2, y: (ch - height) / 2, width: height * ratio, height };
}
export function rectTransform(rect, width, height) {
  return { version: 1, mode: 'manual', center_x: (rect.x + rect.width / 2) / width,
    center_y: (rect.y + rect.height / 2) / height, width: rect.width / width, height: rect.height / height };
}
export function resizeRect(rect, handle, dx, dy, minimum = 0.000001) {
  if (handle === 'move') return { ...rect, x: rect.x + dx, y: rect.y + dy };
  const west = handle.includes('w'), north = handle.includes('n');
  let width = rect.width, height = rect.height;
  if (handle.length === 2) {
    const sx = west ? -1 : 1, sy = north ? -1 : 1;
    const scale = Math.max(minimum / Math.min(width, height), 1 + (sx * dx * width + sy * dy * height) / (width * width + height * height));
    width *= scale; height *= scale;
  } else {
    if (handle === 'w' || handle === 'e') width = Math.max(minimum, width + (west ? -dx : dx));
    else height = Math.max(minimum, height + (north ? -dy : dy));
  }
  return { x: west ? rect.x + rect.width - width : rect.x,
    y: north ? rect.y + rect.height - height : rect.y, width, height };
}
export function editorView(width, height, selected, viewport) {
  const left = Math.min(0, selected?.x ?? 0), top = Math.min(0, selected?.y ?? 0);
  const right = Math.max(width, selected ? selected.x + selected.width : width);
  const bottom = Math.max(height, selected ? selected.y + selected.height : height);
  const scale = Math.max(0.000001, Math.min(Math.max(1, viewport.width - 48) / (right - left), Math.max(1, viewport.height - 48) / (bottom - top)));
  return { scale, left: (viewport.width - (right - left) * scale) / 2 - left * scale,
    top: (viewport.height - (bottom - top) * scale) / 2 - top * scale };
}
export function pointInRect(x, y, rect) {
  return rect && x >= rect.x && y >= rect.y && x <= rect.x + rect.width && y <= rect.y + rect.height;
}
