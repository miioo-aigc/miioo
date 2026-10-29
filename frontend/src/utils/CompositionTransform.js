/** 构图以成片画布归一化，不依赖预览分辨率和编辑视图倍率。 */
export const containTransform = () => ({ version: 1, mode: 'legacy_contain' });
// 固定以默认完整显示宽度为100%，非等比形变仍保留当前宽高比。
export function visualScalePercent(transform, sourceRatio, outputRatio) {
  const base = transformRect(containTransform(), sourceRatio, outputRatio, 1);
  const current = transformRect(transform, sourceRatio, outputRatio, 1);
  return base && current ? current.width / base.width * 100 : 100;
}
export function scaleVisualTransform(transform, sourceRatio, outputRatio, percent) {
  const current = transformRect(transform, sourceRatio, outputRatio, 1);
  if (!current || !Number.isFinite(percent)) return null;
  const factor = Math.max(1, Math.min(200, percent)) / visualScalePercent(transform, sourceRatio, outputRatio);
  const normalized = rectTransform(current, outputRatio, 1);
  return { ...normalized, width: normalized.width * factor, height: normalized.height * factor,
    center_x: 0.5 + (normalized.center_x - 0.5) * factor,
    center_y: 0.5 + (normalized.center_y - 0.5) * factor };
}
/** 按原始素材比例居中铺满指定轴，输出既有 manual 协议，不继承拉伸。 */
export function fitAxisTransform(sourceRatio, outputRatio, axis) {
  if (!(sourceRatio > 0) || !(outputRatio > 0) || !['width', 'height'].includes(axis)) return null;
  return { version: 1, mode: 'manual', center_x: 0.5, center_y: 0.5,
    width: axis === 'width' ? 1 : sourceRatio / outputRatio,
    height: axis === 'height' ? 1 : outputRatio / sourceRatio };
}
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
export function pointInRect(x, y, rect) {
  return rect && x >= rect.x && y >= rect.y && x <= rect.x + rect.width && y <= rect.y + rect.height;
}
