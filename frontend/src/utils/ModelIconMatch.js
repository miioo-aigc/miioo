/** 模型图标匹配：模型标识负责稳定兜底，名称关键词负责兼容展示名。 */
export function isVegaModelIcon(modelId) {
  return String(modelId || '').toLowerCase().includes('vega');
}

export function isWanModelIcon(modelId) {
  return /^wan(?:\d+(?:\.\d+)*)-video(?:-prime)?$/i.test(String(modelId || '').trim());
}

export const WAN_MODEL_KEYWORDS = ['wan', '万相'];

/** 名称匹配不区分大小写，并忽略空格、连接符和装饰符号。 */
export function matchesModelIconKeywords(name, keywords) {
  if (!name || !Array.isArray(keywords)) return false;
  const normalizedName = String(name).toLowerCase().replace(/[\s_\-•·]/g, '');
  return keywords.some((keyword) => {
    const normalizedKeyword = String(keyword || '').toLowerCase().replace(/[\s_\-•·]/g, '');
    return normalizedKeyword && normalizedName.includes(normalizedKeyword);
  });
}

