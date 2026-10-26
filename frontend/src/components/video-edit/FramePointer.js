/** 将屏幕坐标转换为胶片条内部坐标，包含弹窗缩放、边框和横向滚动。 */
export function framePointerPosition(clientX, rect, layoutWidth, borderLeft, scrollLeft, frameWidth, count) {
  const scale = rect.width / layoutWidth || 1;
  const position = Math.max(0, Math.min(count * frameWidth, (clientX - rect.left) / scale - borderLeft + scrollLeft));
  return { position, index: Math.max(0, Math.min(count - 1, Math.floor(position / frameWidth))) };
}
