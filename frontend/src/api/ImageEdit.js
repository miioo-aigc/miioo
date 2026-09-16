import { authFetch } from './request';
import { mayShowEditPrompt, readEditMetadata } from '../utils/MediaEditPolicy';

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

// 不把候选记录编号或重新上传的资产伪装成真实源资产。
export async function apiPrepareEditSource(card) {
  const id = card.creationAssetId || card.asset_id || card.assetId || card.backendId;
  const url = card.originalUrl || card.original_url || card.download_url || card.downloadUrl || card.imageUrl;
  if (typeof id !== 'string' || !id.trim() || /^(local[-_:]|blob:)/.test(id)) throw new Error('当前图片缺少真实源资产编号，无法保存编辑归属');
  if (!url) throw new Error('未找到可用原图');
  return { id, url };
}

export async function apiSubmitImageEdit() {
  // 现有 erase/generate 契约缺少编辑类型、指定模型与业务归属继承保证。
  // 保留旧任务回读能力；新请求须等后端契约明确后再开放。
  throw new Error('图片编辑保存契约尚未接入：需确认指定模型、编辑模式及原资产归属继承，尚未提交生成');
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
  return { ...readEditMetadata(image), metadata_json: image.metadata_json, remoteUrl, originalUrl: remoteUrl, creationAssetId, backendId: creationAssetId, model: image.model, prompt: mayShowEditPrompt(image) ? image.prompt : '', ratio: image.aspect_ratio, resolution: image.resolution, source: 'backend-image-edit' };
}
