export function selectCanvasMediaModel(options, models, selected) {
  const matches = (option, id) => option.value === id || option.sourceModelIds?.includes(id);
  const current = selected && options.find((option) => matches(option, selected));
  const preferred = models.find((model) => model.is_default && model.is_enabled
    && options.some((option) => matches(option, model.model_id)));
  return current?.value
    ?? options.find((option) => preferred && matches(option, preferred.model_id))?.value
    ?? options[0]?.value ?? '';
}
