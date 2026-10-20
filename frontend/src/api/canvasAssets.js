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
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function firstValue(value, keys) {
  return keys.map((key) => value?.[key]).find((item) => item !== undefined && item !== null && item !== '') || null;
}

export function normalizeCanvasUploadedAsset(result, file, assetType) {
  const item = result?.asset || result?.image || result?.video || result?.audio || result;
  const assetId = firstValue(item, ['asset_id', 'assetId']) || firstValue(result, ['asset_id', 'assetId'])
    || firstValue(item, ['id']) || firstValue(result, ['id']);
  const url = firstValue(item, ['file_url', 'fileUrl', 'uploaded_url', 'uploadedUrl', 'url', 'preview_url', 'previewUrl'])
    || firstValue(result, ['file_url', 'fileUrl', 'uploaded_url', 'uploadedUrl', 'url']);
  if (typeof assetId !== 'string' || !UUID.test(assetId)) throw new Error('上传响应未提供合法的永久素材编号，不能保存画布');
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

/** projectId 决定项目归属；不将画布编号伪装成 session_id。 */
export async function uploadCanvasAsset(file, assetType, { signal, projectId } = {}) {
  const uploader = UPLOADERS[assetType];
  if (!uploader) throw new Error(`不支持上传的画布资产类型：${assetType}`);
  if (projectId != null && (typeof projectId !== 'string' || !UUID.test(projectId))) {
    throw new Error('当前项目不是正式后端项目，不能上传永久素材；不会改存为个人素材');
  }
  const result = await uploader({
    file,
    category: 'reference',
    asset_name: file.name,
    project_id: projectId || undefined,
    signal,
  });
  return normalizeCanvasUploadedAsset(result, file, assetType);
}
