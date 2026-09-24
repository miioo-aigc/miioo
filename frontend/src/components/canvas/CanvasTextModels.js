// 输入来自 chat 分类接口；额外排除误入的媒体模型及禁用项。
export function getCanvasTextModels(list) {
  return (Array.isArray(list) ? list : [])
    .filter((model) => model.model_id && model.is_enabled !== false && (!model.category || model.category === 'chat'))
    .map((model) => ({ value: model.model_id, label: model.name || model.model_id, isDefault: model.is_default === true }));
}

export function getCanvasTextModelValue(models, selected) {
  return models.find((model) => model.value === selected)?.value
    || models.find((model) => model.isDefault)?.value
    || models[0]?.value || '';
}
