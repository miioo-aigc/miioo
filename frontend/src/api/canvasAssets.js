import {
  apiUploadCreationAudio,
  apiUploadCreationImage,
  apiUploadCreationVideo,
} from './creation.js';

const UPLOADERS = {
  image: apiUploadCreationImage,
  video: apiUploadCreationVideo,
  audio: apiUploadCreationAudio,
};

function firstValue(value, keys) {
  return keys.map((key) => value?.[key]).find((item) => item !== undefined && item !== null && item !== '') || null;
}

export function normalizeCanvasUploadedAsset(result, file, assetType) {
  const item = result?.asset || result?.image || result?.video || result?.audio || result;
  const assetId = firstValue(item, ['asset_id', 'assetId', 'id']) || firstValue(result, ['asset_id', 'assetId', 'id']);
  const url = firstValue(item, ['file_url', 'fileUrl', 'uploaded_url', 'uploadedUrl', 'url', 'preview_url', 'previewUrl'])
    || firstValue(result, ['file_url', 'fileUrl', 'uploaded_url', 'uploadedUrl', 'url']);
  if (!assetId) throw new Error('上传成功但服务端没有返回正式资产 ID');
  if (!url) throw new Error('上传成功但服务端没有返回可预览地址');
  return {
    ...item,
    asset_id: assetId,
    asset_type: assetType,
    name: item?.name || file.name,
    url,
    persistentUrl: url,
    previewUrl: firstValue(item, ['preview_url', 'previewUrl', 'thumbnail_url', 'thumbnailUrl']) || url,
    source: 'local-upload',
    uploadStatus: 'ready',
    uploadError: null,
  };
}

/** 画布专用上传边界。后端替换为 canvas-assets 接口时只需替换此文件。 */
export async function uploadCanvasAsset(file, assetType, { signal, projectId } = {}) {
  const uploader = UPLOADERS[assetType];
  if (!uploader) throw new Error(`不支持上传的画布资产类型：${assetType}`);
  const result = await uploader({
    file,
    category: 'reference',
    asset_name: file.name,
    project_id: projectId || undefined,
    signal,
  });
  return normalizeCanvasUploadedAsset(result, file, assetType);
}
