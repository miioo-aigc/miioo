import { authFetchForm } from './request';
import { apiReadEditedImage, normalizeEditedImage } from './ImageEdit';
import { apiAddSubjectImageFromAsset } from './subject';
import { apiCreateStoryboardMediaCandidate } from './storyboard';

const BASE = import.meta.env.VITE_API_BASE_URL;

export async function prepareImageEditDestination(scope, sourceId) {
  const [kind, projectId, targetId] = (scope || '').split(':');
  if (['subject', 'storyboard'].includes(kind)) {
    if (!projectId || !targetId || [projectId, targetId].some((id) => ['undefined', 'null'].includes(id))) {
      throw new Error('缺少原图片的项目或候选列表归属，尚未提交编辑');
    }
    return { kind, project_id: projectId, targetId };
  }
  if (kind !== 'creation') throw new Error('当前列表未连接云端编辑保存');
  const source = await apiReadEditedImage(sourceId);
  let metadata = source.metadata_json || {};
  if (typeof metadata === 'string') metadata = JSON.parse(metadata);
  const context = { kind, project_id: source.project_id || metadata.project_id,
    session_id: source.session_id || metadata.session_id, shot_id: source.shot_id || metadata.shot_id };
  if (!context.session_id && !context.shot_id) {
    throw new Error('原资产未返回创作会话或镜头归属，无法保证编辑结果回到原创作记录');
  }
  return context;
}

export async function uploadImageEditFile(file, destination) {
  const query = new URLSearchParams();
  for (const key of ['project_id', 'session_id', 'shot_id']) {
    if (destination[key]) query.set(key, destination[key]);
  }
  const form = new FormData();
  form.append('file', file, 'image-edit.png');
  const response = await authFetchForm(`${BASE}/api/creation/images/upload?${query}`, { method: 'POST', body: form });
  const data = await response.json();
  if (!response.ok) throw new Error(typeof data.detail === 'string' ? data.detail : `保存编辑图片失败（${response.status}）`);
  const id = data.asset_id || data.image?.asset_id || data.image?.id;
  if (!id) throw new Error('上传结果缺少资产编号，请核查资产库，不要重复上传');
  return apiReadEditedImage(id);
}

export async function bindImageEditResult(image, destination) {
  const normalized = normalizeEditedImage(image);
  if (destination.kind === 'subject') {
    await apiAddSubjectImageFromAsset(destination.project_id, destination.targetId, normalized.creationAssetId);
  } else if (destination.kind === 'storyboard') {
    await apiCreateStoryboardMediaCandidate(destination.project_id, destination.targetId, {
      media_type: 'image', url: normalized.originalUrl, asset_id: normalized.creationAssetId,
      source: 'asset-library', metadata: { edit_type: image.edit_type, edit_mode: image.edit_mode, source_asset_id: image.source_asset_id },
    });
  } else {
    let metadata = image.metadata_json || {};
    if (typeof metadata === 'string') metadata = JSON.parse(metadata);
    for (const key of ['session_id', 'shot_id']) {
      if (destination[key] && (image[key] || metadata[key]) !== destination[key]) {
        throw new Error('新图片已生成，但后端未返回相同创作归属；请勿重复生成，需要核对后端归属继承');
      }
    }
  }
  return normalized;
}
