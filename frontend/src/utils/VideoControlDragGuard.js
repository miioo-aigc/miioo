/** 原生视频控件不应启动媒体拖放；保留进度、音量和全屏的指针操作。 */
export function installVideoControlDragGuard(target = window) {
  const preventMediaDrag = (event) => {
    // Chrome 原生控件内部事件可能被重定向到 video。
    const path = event.composedPath?.() || [event.target];
    if (!path.some(node => node?.tagName === 'VIDEO' && node.controls)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  };
  target.addEventListener('dragstart', preventMediaDrag, { capture: true });
  return () => target.removeEventListener('dragstart', preventMediaDrag, { capture: true });
}
