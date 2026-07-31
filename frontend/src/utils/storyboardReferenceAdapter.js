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
 * 读取创作图片上传响应中的真实图片地址。
 * 上传接口的地址可能位于顶层，也可能位于返回的 image/asset 对象中。
 */
export function getUploadedImageUrl(response) {
  const image = response?.image || response?.asset || response?.uploaded_asset || response?.uploadedAsset || {};
  const data = response?.data || {};
  return response?.uploaded_url
    || response?.uploadedUrl
    || response?.url
    || response?.file_url
    || response?.fileUrl
    || image.original_url
    || image.originalUrl
    || image.thumbnail_url
    || image.thumbnailUrl
    || image.file_url
    || image.fileUrl
    || image.url
    || data.uploaded_url
    || data.uploadedUrl
    || data.url
    || data.file_url
    || data.fileUrl
    || '';
}

export function getUploadedImageId(response, fallback = '') {
  const image = response?.image || response?.asset || response?.uploaded_asset || response?.uploadedAsset || {};
  return response?.asset_id
    || response?.assetId
    || response?.id
    || image.asset_id
    || image.assetId
    || image.id
    || fallback;
}

/**
 * 将资产选择结果转换为分镜 mainRefs 条目。
 * 带 subject_id 的资产保持主体引用语义，普通资产保持普通参考图语义。
 */
export function buildStoryboardRefFromAsset(asset) {
  const url = normalizeImageUrl(
    asset?.fileUrl
      || asset?.file_url
      || asset?.originalUrl
      || asset?.original_url
      || asset?.previewUrl
      || asset?.preview_url
      || asset?.url,
  ) ?? null;
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
