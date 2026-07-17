/**
 * @file storyboardReferenceAdapter.js
 * @structure-index
 *
 * 分镜参考资产到前端 mainRefs 模型的纯适配，不读取页面状态、不调用 API。
 */

import { normalizeImageUrl, toAbsoluteUrl } from './imageUrl';

export function subjectTypeFromCategory(category) {
  if (category === 'character') return 'char';
  if (category === 'scene') return 'scene';
  if (category === 'prop') return 'prop';
  return 'other';
}

/**
 * 将资产选择结果转换为分镜 mainRefs 条目。
 * 带 subject_id 的资产保持主体引用语义，普通资产保持普通参考图语义。
 */
export function buildStoryboardRefFromAsset(asset) {
  const url = normalizeImageUrl(asset?.fileUrl || asset?.url) ?? null;
  const subjectId = asset?.subject_id ?? asset?.subjectId ?? null;
  if (subjectId) {
    const categoryType = subjectTypeFromCategory(asset?.category);
    const type = ['char', 'scene', 'prop'].includes(categoryType) ? categoryType : 'char';
    return {
      id: subjectId,
      subjectId,
      assetId: asset?.id,
      url,
      name: asset?.name,
      type,
    };
  }
  return {
    id: asset?.id,
    assetId: asset?.id,
    url,
    name: asset?.name,
    type: asset?.type ?? 'image',
  };
}

/**
 * 将生成面板的参考图转换为后端可消费的绝对 URL，并过滤不支持的派生格式。
 */
export function toSafeStoryboardReferenceUrls(refImages = []) {
  return refImages
    .map((item) => toAbsoluteUrl(typeof item === 'string' ? item : item?.url))
    .filter((url) => url && !url.toLowerCase().endsWith('.avif') && !url.includes('/derived/assets/'));
}
