/**
 * 将分镜视频参考素材转换为后端生成请求字段。
 * 分镜视频沿用创作页已经存在的 Seedance 调用边界：真人认证素材走
 * provider_params.live_material；虚拟人像使用素材库返回的 asset_ref_url
 * 作为服务商引用附件，不使用预览图，也不附带普通资产 ID。
 */

import { toSafeStoryboardReferenceUrls } from './storyboardReferenceAdapter';

function readValue(item, keys) {
  for (const key of keys) {
    const value = item?.[key];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return undefined;
}

function getSubjectId(item) {
  return readValue(item, ['subjectId', 'subject_id']);
}

function getItemId(item) {
  return readValue(item, ['id']);
}

function getItemName(item) {
  return readValue(item, ['name', 'title']);
}

function getIdentityKeys(item) {
  return [getSubjectId(item), getAssetId(item), getItemId(item)]
    .filter((value) => value !== undefined && value !== null && value !== '')
    .map((value) => String(value));
}

function getSeedanceFields(item) {
  return {
    assetId: readValue(item, ['assetId', 'asset_id']),
    isLiveMaterial: readValue(item, ['isLiveMaterial', 'is_live_material']),
    isAigcMaterial: readValue(item, ['isAigcMaterial', 'is_aigc_material']),
    isSeedanceMaterial: readValue(item, ['isSeedanceMaterial', 'is_seedance_material']),
    isSeedanceCertifiedMaterial: readValue(item, [
      'isSeedanceCertifiedMaterial',
      'is_seedance_certified_material',
    ]),
    groupId: readValue(item, ['groupId', 'group_id']),
    groupType: readValue(item, ['groupType', 'group_type']),
    assetRefUrl: readValue(item, ['assetRefUrl', 'asset_ref_url']),
  };
}

function hasSeedanceFields(item) {
  const fields = getSeedanceFields(item);
  return Boolean(
    fields.isLiveMaterial
    || fields.isAigcMaterial
    || fields.isSeedanceMaterial
    || fields.isSeedanceCertifiedMaterial
    || fields.groupId
    || fields.assetRefUrl,
  );
}

function mergeSeedanceFieldsFromSource(reference, source) {
  const sourceFields = getSeedanceFields(source);
  return {
    ...reference,
    // 来源是镜头响应中完整的认证实体，优先覆盖展示状态里遗留的普通资产身份。
    ...(sourceFields.assetId !== undefined
      ? { assetId: sourceFields.assetId }
      : {}),
    ...(sourceFields.isLiveMaterial !== undefined
      ? { isLiveMaterial: sourceFields.isLiveMaterial }
      : {}),
    ...(sourceFields.isAigcMaterial !== undefined
      ? { isAigcMaterial: sourceFields.isAigcMaterial }
      : {}),
    ...(sourceFields.isSeedanceMaterial !== undefined
      ? { isSeedanceMaterial: sourceFields.isSeedanceMaterial }
      : {}),
    ...(sourceFields.isSeedanceCertifiedMaterial !== undefined
      ? { isSeedanceCertifiedMaterial: sourceFields.isSeedanceCertifiedMaterial }
      : {}),
    ...(sourceFields.groupId !== undefined
      ? { groupId: sourceFields.groupId }
      : {}),
    ...(sourceFields.groupType !== undefined
      ? { groupType: sourceFields.groupType }
      : {}),
    ...(sourceFields.assetRefUrl !== undefined
      ? { assetRefUrl: sourceFields.assetRefUrl }
      : {}),
  };
}

/**
 * 面板展示状态在历史兼容链路中可能只保留图片 URL 和普通资产 ID。
 * 发起请求前以镜头已保存的 refSubjects/mainRefs 为身份来源补回认证字段，
 * 但绝不把来源列表中未被当前用户选择的条目加入参考图请求。
 */
export function enrichStoryboardVideoReferenceMedia(
  referenceMedia = [],
  persistedRefSubjects = [],
  mainRefs = [],
) {
  const items = Array.isArray(referenceMedia) ? referenceMedia.filter(Boolean) : [];
  const sources = [...(Array.isArray(persistedRefSubjects) ? persistedRefSubjects : []), ...(Array.isArray(mainRefs) ? mainRefs : [])]
    .filter((item) => item && hasSeedanceFields(item));
  if (items.length === 0 || sources.length === 0) return items;

  const sourcesByIdentity = new Map();
  const sourcesByName = new Map();
  sources.forEach((source) => {
    getIdentityKeys(source).forEach((key) => {
      if (!sourcesByIdentity.has(key)) sourcesByIdentity.set(key, source);
    });
    const name = getItemName(source);
    if (name && !sourcesByName.has(String(name))) sourcesByName.set(String(name), source);
  });

  return items.map((item) => {
    const source = getIdentityKeys(item)
      .map((key) => sourcesByIdentity.get(key))
      .find(Boolean)
      || sourcesByName.get(String(getItemName(item) || ''));
    return source ? mergeSeedanceFieldsFromSource(item, source) : item;
  });
}

function getAssetId(item) {
  return item?.assetId || item?.asset_id || item?.backendId || item?.id || '';
}

function getGroupId(item) {
  return item?.groupId || item?.group_id || '';
}

function getGroupType(item) {
  return item?.groupType || item?.group_type || 'LivenessFace';
}

function isSeedanceCertifiedMaterial(item) {
  return item?.isSeedanceCertifiedMaterial === true
    || (
      (item?.isSeedanceMaterial === true || item?.isLiveMaterial === true || item?.isAigcMaterial === true)
      && Boolean(getGroupId(item))
      && Boolean(getAssetId(item))
  );
}

function isAigcMaterial(item) {
  return item?.isAigcMaterial === true
    || String(getGroupType(item)).toUpperCase() === 'AIGC';
}

function getReferenceUrl(item) {
  return isAigcMaterial(item)
    ? (item?.assetRefUrl || item?.asset_ref_url || '')
    : (item?.url || item?.fileUrl || item?.file_url || '');
}

/**
 * 真人与 AIGC 都属于 Seedance 素材库资源，但调用方式不同：
 * 真人使用 live_material；AIGC 使用 asset:// 引用附件。两者都不能把
 * 浏览器预览图当成模型输入。
 */
export function buildStoryboardVideoReferencePayload(referenceMedia = []) {
  const items = Array.isArray(referenceMedia) ? referenceMedia.filter(Boolean) : [];
  const liveGroups = new Map();
  const regularItems = [];
  const referenceImageAssetIds = [];

  items.forEach((item) => {
    const assetId = getAssetId(item);
    if (isSeedanceCertifiedMaterial(item) && !isAigcMaterial(item)) {
      const groupId = getGroupId(item);
      const group = liveGroups.get(groupId) || {
        group_id: groupId,
        group_type: getGroupType(item),
        asset_ids: [],
      };
      if (!group.asset_ids.includes(assetId)) group.asset_ids.push(assetId);
      liveGroups.set(groupId, group);
      return;
    }

    regularItems.push(item);
    if (assetId && !isAigcMaterial(item)) referenceImageAssetIds.push(assetId);
  });

  const payload = {};
  const requestItems = regularItems.map((item) => ({ ...item, url: getReferenceUrl(item) }));
  const referenceImages = toSafeStoryboardReferenceUrls(requestItems);
  if (referenceImages.length) payload.reference_images = referenceImages;
  if (referenceImageAssetIds.length) {
    payload.reference_image_asset_ids = [...new Set(referenceImageAssetIds)];
  }
  const attachments = regularItems
    .map((item) => {
      const url = toSafeStoryboardReferenceUrls([{ ...item, url: getReferenceUrl(item) }])[0];
      if (!url) return null;
      return {
        asset_id: isAigcMaterial(item) ? undefined : (getAssetId(item) || undefined),
        asset_type: 'image',
        url,
        role: 'reference',
        source: 'mention',
      };
    })
    .filter(Boolean);
  if (attachments.length) payload.attachments = attachments;

  const liveMaterial = [...liveGroups.values()].find((group) => group.asset_ids.length);
  if (liveMaterial) payload.provider_params = { live_material: liveMaterial };

  return payload;
}
