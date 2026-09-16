export const EDIT_MODE_LABELS = Object.freeze({
  multi_angle: '多机位', inpaint: '局部重绘', erase: '消除笔', upscale: '智能超清',
  outpaint: '扩图', crop: '裁剪', flip: '翻转', subtitle_remove: '去字幕',
  frame_extract: '选帧', trim: '剪辑',
});

export function validateExpansion(options) {
  const values = ['up', 'down', 'left', 'right'].map((side) => options?.[`${side}_expansion_ratio`]);
  if (values.some((value) => typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 2)) {
    throw new Error('每个方向的扩展比例必须在0到2之间');
  }
  const [up, down, left, right] = values;
  if (!values.some((value) => value > 0)) throw new Error('请先扩大画布');
  if ((1 + left + right) * (1 + up + down) > 3 + Number.EPSILON * 8) {
    throw new Error('扩展后的面积不能超过原图3倍');
  }
  return options;
}

export function readEditMetadata(asset = {}) {
  let metadata = asset.metadata_json || asset.metadata || {};
  if (typeof metadata === 'string') {
    try { metadata = JSON.parse(metadata); } catch { metadata = {}; }
  }
  const mode = asset.edit_mode || asset.editMode || metadata?.edit_mode || metadata?.editMode;
  const type = asset.edit_type || asset.editType || metadata?.edit_type || metadata?.editType;
  return { edit_mode: mode, edit_type: type, source_asset_id: asset.source_asset_id || metadata?.source_asset_id };
}

export function mayShowEditPrompt(asset) {
  if (asset?.show_prompt === false || asset?.showPrompt === false) return false;
  const { edit_type: type, edit_mode: mode } = readEditMetadata(asset);
  if (!type && !mode) return true;
  return mode === 'inpaint' || mode === 'outpaint';
}
