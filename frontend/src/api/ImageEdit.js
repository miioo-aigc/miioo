import { authFetch } from './request';
import { apiUploadCreationImage } from './creation';

const BASE = import.meta.env.VITE_API_BASE_URL;

async function request(path, body) {
  const response = await authFetch(`${BASE}${path}`, body ? { method: 'POST', body: JSON.stringify(body) } : {});
  const data = await response.json();
  if (!response.ok) throw new Error(typeof data.detail === 'string' ? data.detail : `图片编辑请求失败（${response.status}）`);
  return data;
}

export async function apiReadEditedImage(id) {
  return request(`/api/creation/images/${encodeURIComponent(id)}`);
}

// 只信任显式的创作资产编号；主体、分镜和候选图的 id 不能用于 erase。
export async function apiPrepareEditSource(card) {
  if (card.creationAssetId) return { id: card.creationAssetId, url: card.originalUrl || card.imageUrl };
  const response = card.blob ? null : await fetch(card.originalUrl || card.original_url || card.imageUrl);
  if (response && !response.ok) throw new Error('原图读取失败，请刷新后重试');
  const blob = card.blob || await response.blob();
  const uploaded = await apiUploadCreationImage({ file: new File([blob], 'edit-source.png', { type: blob.type || 'image/png' }) });
  const id = uploaded.asset_id || uploaded.image?.id;
  const url = uploaded.uploaded_url || uploaded.uploadedUrl || uploaded.image?.original_url;
  if (!id || !url) throw new Error(typeof uploaded.detail === 'string' ? uploaded.detail : '原图上传未返回有效资产');
  return { id, url };
}

export async function apiSubmitImageEdit(source, { mode, mask, prompt, model, ratio, resolution, expandOptions }) {
  if (mode === 'outpaint') return request('/api/creation/images/generate', {
    prompt: prompt || '自然延展原图画面，保持原图主体、风格和光照一致', model,
    generation_mode: 'outpainting', expand_options: expandOptions,
    reference_images: [source.url], count: 1, save_to_assets: true,
  });
  return request(`/api/creation/images/${encodeURIComponent(source.id)}/erase`, {
    mask_data_url: mask, prompt: prompt || null, model, ratio, resolution,
  });
}

export async function apiResolveImageEdit(accepted, mode) {
  const taskId = accepted.task_id || accepted.taskId;
  if (!taskId && mode !== 'outpaint') return accepted;
  const id = taskId || accepted.id;
  if (!id) throw new Error('生成服务未返回任务编号');
  const started = Date.now();
  let failures = 0;
  while (Date.now() - started < 1800000) {
    let task;
    try {
      task = await request(mode === 'outpaint' ? `/api/creation/tasks/${encodeURIComponent(id)}` : `/api/tasks/${encodeURIComponent(id)}`);
      failures = 0;
    } catch (error) {
      if (++failures >= 5) throw error;
    }
    if (['failed', 'cancelled'].includes(task?.status)) throw Object.assign(new Error(task.params?.error_message || task.error_message || '图片编辑任务失败或已取消'), { terminal: true });
    if (['completed', 'done', 'success', 'partial'].includes(task?.status)) {
      const result = task.results?.find((item) => item.success && item.asset_id);
      const image = task.images?.[0];
      const assetId = result?.asset_id || image?.asset_id || image?.id;
      if (!assetId) throw Object.assign(new Error('任务结束但未返回可用图片资产'), { terminal: true });
      return apiReadEditedImage(assetId);
    }
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  throw new Error('等待图片超时，可再次点击生成继续读取原任务');
}

export function normalizeEditedImage(image) {
  const remoteUrl = image.original_url || image.originalUrl;
  const creationAssetId = image.asset_id || image.id;
  if (!remoteUrl || !creationAssetId) throw new Error('编辑结果缺少原图或资产编号');
  return { remoteUrl, originalUrl: remoteUrl, creationAssetId, backendId: creationAssetId, model: image.model, prompt: image.prompt, ratio: image.aspect_ratio, resolution: image.resolution, source: 'backend-image-edit' };
}
