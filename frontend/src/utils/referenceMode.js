/**
 * 将后端视频参考模式转换为详情弹窗使用的中文展示文案。
 * 后端值保留在数据层，只有展示层做语义化映射。
 */
export function formatReferenceMode(value) {
  if (value === undefined || value === null || value === '') return '';
  const normalized = String(value).trim().toLowerCase();
  if (['full', 'full_ref', 'all'].includes(normalized)) return '全能参考';
  if (['frame', 'frame_ref'].includes(normalized)) return '首尾帧';
  return String(value);
}
