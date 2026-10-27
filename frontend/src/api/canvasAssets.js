import {
  apiUploadCreationAudio,
  apiUploadCreationImage,
  apiUploadCreationVideo,
} from './creation.js';
import { getAuthSessionGeneration } from './request.js';
import { getImageReferenceId, getImageReferenceUrl, isManagedImageUrl } from './ImageReferences.js';

const pendingUploads = new Map();
let uploadSession;
/** 同一会话、项目、临时素材复用上传；失败可重试，临时预览随画布历史保留。 */
export function ensureCanvasImageAsset(asset, { projectId } = {}) {
  const session = getAuthSessionGeneration();
  if (session !== uploadSession) { pendingUploads.clear(); uploadSession = session; }
  if (getImageReferenceId(asset)) return Promise.resolve(asset);
  const url = getImageReferenceUrl(asset);
  if (!asset?.file && isManagedImageUrl(url)) return Promise.resolve(asset);
  const key = `${session}:${projectId || ''}:${url}`;
  if (pendingUploads.has(key)) return pendingUploads.get(key);
  const pending = (async () => {
    let file = asset?.file;
    if (!file && (url.startsWith('blob:') || url.startsWith('data:image/'))) {
      const response = await fetch(url);
      if (!response.ok) throw new Error('参考图读取失败，请重新上传');
      const blob = await response.blob();
      file = new File([blob], asset?.name || '参考图', { type: blob.type || 'image/png' });
    }
    if (!(file instanceof File)) throw new Error('参考图地址已失效，请重新上传');
    return uploadCanvasAsset(file, 'image', { projectId });
  })();
  pendingUploads.set(key, pending);
  pending.catch(() => { if (pendingUploads.get(key) === pending) pendingUploads.delete(key); });
  return pending;
}

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
  const url = firstValue(item, ['original_url', 'originalUrl', 'file_url', 'fileUrl'])
    || firstValue(result, ['original_url', 'originalUrl', 'file_url', 'fileUrl'])
    || firstValue(result, ['uploaded_url', 'uploadedUrl'])
    || firstValue(item, ['original_url', 'originalUrl', 'file_url', 'fileUrl', 'uploaded_url', 'uploadedUrl', 'url'])
    || firstValue(result, ['file_url', 'fileUrl', 'url']);
  if (typeof assetId !== 'string' || !UUID.test(assetId)) throw new Error('上传响应未提供合法的永久素材编号，不能保存画布');
  if (!isManagedImageUrl(url)) throw new Error('上传成功但服务端没有返回有效素材地址');
  return {
    ...item,
    asset_id: assetId,
    asset_type: assetType,
    name: item?.name || file.name,
    url,
    persistentUrl: url,
    originalUrl: url,
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
