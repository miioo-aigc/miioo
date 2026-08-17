/**
 * @file storyboardReferenceAdapter.js
 * @structure-index
 *
 * 分镜参考资产到前端 mainRefs 模型的纯适配，不读取页面状态、不调用 API。
 *
 * 更新记录：
 * 2026-08-17  Seedance 素材保留组、素材和预览信息，主体引用可从主体列表补全认证身份；
 *              真人走认证参数，虚拟人像走 asset_ref_url
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
  const nestedImage = data?.image || data?.asset || data?.uploaded_asset || data?.uploadedAsset || response?.result || {};
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
    || nestedImage.uploaded_url
    || nestedImage.uploadedUrl
    || nestedImage.original_url
    || nestedImage.originalUrl
    || nestedImage.file_url
    || nestedImage.fileUrl
    || nestedImage.url
    || '';
}

export function getUploadedImageId(response, fallback = '') {
  const image = response?.image || response?.asset || response?.uploaded_asset || response?.uploadedAsset || {};
  const data = response?.data || {};
  const nestedImage = data?.image || data?.asset || data?.uploaded_asset || data?.uploadedAsset || response?.result || {};
  return response?.asset_id
    || response?.assetId
    || response?.id
    || image.asset_id
    || image.assetId
    || image.id
    || data.asset_id
    || data.assetId
    || data.id
    || nestedImage.asset_id
    || nestedImage.assetId
    || nestedImage.id
    || fallback;
}

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null);
}

/**
 * 读取 Seedance 素材认证身份，兼容接口 snake_case 与前端 camelCase。
 * 返回 undefined 表示来源未提供该字段，供合并时区分“未提供”和 false。
 */
export function getStoryboardSeedanceMaterialFields(item) {
  return {
    isLiveMaterial: firstDefined(item?.isLiveMaterial, item?.is_live_material),
    isAigcMaterial: firstDefined(item?.isAigcMaterial, item?.is_aigc_material),
    isSeedanceMaterial: firstDefined(item?.isSeedanceMaterial, item?.is_seedance_material),
    isSeedanceCertifiedMaterial: firstDefined(
      item?.isSeedanceCertifiedMaterial,
      item?.is_seedance_certified_material,
    ),
    groupId: firstDefined(item?.groupId, item?.group_id),
    groupType: firstDefined(item?.groupType, item?.group_type),
    assetRefUrl: firstDefined(item?.assetRefUrl, item?.asset_ref_url),
  };
}

/**
 * 用主体列表中的数据补全分镜参考条目。已有分镜快照优先，避免刷新时被旧主体数据覆盖；
 * 仅补认证字段与资产 ID，不把主体预览图当成 Seedance 服务商引用。
 */
export function mergeStoryboardReferenceWithSubject(reference = {}, subject = {}) {
  const referenceFields = getStoryboardSeedanceMaterialFields(reference);
  const subjectFields = getStoryboardSeedanceMaterialFields(subject);
  return {
    ...reference,
    assetId: firstDefined(reference?.assetId, reference?.asset_id, subject?.assetId, subject?.asset_id),
    isLiveMaterial: firstDefined(referenceFields.isLiveMaterial, subjectFields.isLiveMaterial),
    isAigcMaterial: firstDefined(referenceFields.isAigcMaterial, subjectFields.isAigcMaterial),
    isSeedanceMaterial: firstDefined(referenceFields.isSeedanceMaterial, subjectFields.isSeedanceMaterial),
    isSeedanceCertifiedMaterial: firstDefined(
      referenceFields.isSeedanceCertifiedMaterial,
      subjectFields.isSeedanceCertifiedMaterial,
    ),
    groupId: firstDefined(referenceFields.groupId, subjectFields.groupId),
    groupType: firstDefined(referenceFields.groupType, subjectFields.groupType),
    assetRefUrl: firstDefined(referenceFields.assetRefUrl, subjectFields.assetRefUrl),
  };
}

/**
 * 将资产选择结果转换为分镜 mainRefs 条目。
 * 带 subject_id 的资产保持主体引用语义，普通资产保持普通参考图语义。
 */
export function buildStoryboardRefFromAsset(asset) {
  const url = normalizeImageUrl(
    // Seedance 虚拟人像的 asset_ref_url 用于生成请求，不一定是浏览器可直接加载的图片。
    // 选择器已提供 previewUrl；面板展示必须优先使用该可访问预览地址。
    asset?.previewUrl
      || asset?.preview_url
      || asset?.thumbnailUrl
      || asset?.thumbnail_url
      || asset?.sourceUrl
      || asset?.source_url
      || asset?.fileUrl
      || asset?.file_url
      || asset?.originalUrl
      || asset?.original_url
      || asset?.url,
  ) ?? null;
  const subjectId = asset?.subject_id ?? asset?.subjectId ?? null;
  const assetId = asset?.assetId ?? asset?.asset_id ?? asset?.id;
  const seedanceFields = getStoryboardSeedanceMaterialFields(asset);
  if (subjectId) {
    const categoryType = subjectTypeFromCategory(asset?.category);
    const type = ['char', 'scene', 'prop'].includes(categoryType) ? categoryType : 'char';
    return {
      id: subjectId,
      subjectId,
      assetId,
      url,
      name: asset?.name,
      type,
      ...seedanceFields,
    };
  }
  return {
    id: assetId,
    assetId,
    url,
    name: asset?.name,
    type: asset?.type ?? 'image',
    ...seedanceFields,
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
