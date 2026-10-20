/** 读取正文布局尺寸，不使用含输入框的节点尺寸或受拖动变形影响的屏幕矩形。 */
export function measureCanvasSnapFrames(container) {
  const frames = new Map();
  container?.querySelectorAll('.react-flow__node').forEach((node) => {
    const frame = node.querySelector(':scope > .canvas-node > .canvas-node__frame');
    if (!frame || !frame.offsetWidth || !frame.offsetHeight) return;
    frames.set(node.dataset.id, {
      x: frame.offsetLeft, y: frame.offsetTop,
      width: frame.offsetWidth, height: frame.offsetHeight,
    });
  });
  return frames;
}
