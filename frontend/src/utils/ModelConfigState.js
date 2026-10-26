// 将服务器确认实体应用到配置界面的各份模型列表。
export function validateModelResult(model, providerId, category, modelId) {
  if (!model || typeof model.id !== 'string' || !model.id.trim()
    || (modelId && model.id !== modelId) || model.provider_id !== providerId
    || model.category !== category || typeof model.is_enabled !== 'boolean'
    || typeof model.is_default !== 'boolean' || typeof model.model_id !== 'string'
    || typeof model.name !== 'string') throw new Error('模型返回结果未能确认');
  return model;
}
export function applyModelResult(current, tab, providerId, modelId, result, sortModels) {
  const update = (byTab = {}, owner) => ({ ...byTab, [tab]: sortModels((byTab[tab] ?? []).flatMap(model => {
    if (model.id === modelId && owner === providerId) {
      return result ? [{ ...model, name: result.name, modelId: result.model_id,
        description: result.description || model.description, enabled: result.is_enabled,
        isDefault: result.is_default, isNew: false, justDisabled: !result.is_enabled }] : [];
    }
    return [{ ...model, isDefault: result?.is_default ? false : model.isDefault }];
  })) });
  return { ...current,
    onelinkModelsByTab: update(current.onelinkModelsByTab, current.onelinkProviderId),
    editProviderModelsByTab: update(current.editProviderModelsByTab, current.activeOtherProviderId),
    otherProviders: (current.otherProviders ?? []).map(provider => ({ ...provider, modelsByTab: update(provider.modelsByTab, provider.id) })),
  };
}
