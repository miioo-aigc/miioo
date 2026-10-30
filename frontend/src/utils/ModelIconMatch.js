/** 仅按模型标识识别 Vega；名称匹配继续用于已有品牌。 */
export function isVegaModelIcon(modelId) {
  return String(modelId || '').toLowerCase().includes('vega');
}

