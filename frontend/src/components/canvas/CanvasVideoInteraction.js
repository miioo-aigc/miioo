/** 点击卡片自身属于激活操作，不应中断激活态自动播放；点击卡片之外才停止。 */
export function shouldPauseCanvasVideo(active, container, target) {
  if (!active || !container || !target) return true;
  // window 失焦等事件的 target 不是 DOM 节点，contains 会抛 TypeError，按「卡片之外」处理。
  if (typeof Node !== 'undefined' && !(target instanceof Node)) return true;
  return !container.contains(target);
}
