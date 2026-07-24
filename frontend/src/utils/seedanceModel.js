/**
 * 判断当前模型是否属于 Seedance 系列。
 * 模型 ID 和展示名称都参与判断，兼容不同版本和后端命名方式。
 */
export function isSeedanceModel(model, modelLabel = '') {
  const value = typeof model === 'object'
    ? [model.value, model.model_id, model.id, model.label, model.name].filter(Boolean).join(' ')
    : [model, modelLabel].filter(Boolean).join(' ');
  return /(^|[^a-z])(?:doubao[-_ ]*)?seedance(?:[^a-z]|$)/i.test(String(value));
}
