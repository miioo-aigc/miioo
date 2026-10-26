/** 文本卡片按主方向消费手势，避免斜向滑动同时移动正文和画布。 */
export function handleCanvasTextWheel(event, element, panBy) {
  // 预览捏合交给 React Flow，沿用鼠标锚点、缩放速度及上下限。
  if (event.ctrlKey && element.dataset.textPreview === 'true') return;
  event.preventDefault();
  event.stopPropagation();
  // 编辑区域仍隔离捏合，避免输入时改变画布或浏览器缩放。
  if (event.ctrlKey) return;
  const unit = event.deltaMode === 1 ? 20 : event.deltaMode === 2 ? element.clientHeight : 1;
  if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
    panBy({ x: -event.deltaX * unit * 0.5, y: 0 });
    return;
  }
  element.scrollTop += event.deltaY * unit;
}
