import { authFetchForm } from './request';
import { apiReadEditedImage, normalizeEditedImage } from './ImageEdit';
import { apiAddSubjectImageFromAsset } from './subject';
import { apiCreateStoryboardMediaCandidate } from './storyboard';

const BASE = import.meta.env.VITE_API_BASE_URL;

// 创作详情契约同时提供下划线字段和驼峰别名，提交与结果校验共用同一归属读取规则。
function readCreationContext(image) {
  let metadata = image.metadata_json || {};
  if (typeof metadata === 'string') metadata = JSON.parse(metadata);
  return {
    project_id: image.project_id || image.projectId || metadata.project_id || metadata.projectId,
    session_id: image.session_id || image.sessionId || metadata.session_id || metadata.sessionId,
    shot_id: image.shot_id || image.shotId || metadata.shot_id || metadata.shotId,
  };
}

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
  // 列表归属由入口 scope 决定。创作列表也包含选帧、裁剪等无会话资产，
  // 会话/镜头仅在源图已有时保留；历史 storyboard_id 不作为候选绑定目标。
  return { kind, ...readCreationContext(source) };
}

export async function uploadImageEditFile(file, { sourceAssetId, editMode } = {}) {
  if (!sourceAssetId || /^(local[-_:]|blob:)/.test(sourceAssetId)) throw new Error('缺少真实源资产编号');
  if (!['crop', 'flip'].includes(editMode)) throw new Error('不支持的图片编辑保存类型');
  if (!(file instanceof Blob) || !file.size) throw new Error('缺少编辑结果文件');
  const form = new FormData();
  form.append('file', file, 'image-edit.png');
  form.append('source_asset_id', sourceAssetId);
  form.append('edit_mode', editMode);
  const response = await authFetchForm(`${BASE}/api/creation/images/edit-result`, { method: 'POST', body: form });
  const data = await response.json();
  if (!response.ok) throw Object.assign(new Error(typeof data.detail === 'string' ? data.detail : `保存编辑图片失败（${response.status}）`), {
    terminal: response.status >= 400 && response.status < 500,
  });
  // 接口直接返回已保存的资产卡；归属和编辑血缘由后端从源资产继承。
  normalizeEditedImage(data);
  return data;
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
    const context = readCreationContext(image);
    for (const key of ['session_id', 'shot_id']) {
      if (destination[key] && context[key] !== destination[key]) {
        throw new Error('新图片已生成，但后端未返回相同创作归属；请勿重复生成，需要核对后端归属继承');
      }
    }
  }
  return normalized;
}
