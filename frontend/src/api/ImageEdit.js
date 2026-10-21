import { authFetch } from './request';
import { mayShowEditPrompt, readEditMetadata, validateExpansion } from '../utils/MediaEditPolicy';
import { waitForImageEditTask } from './ImageEditTasks';
import { imageEditSessionCheck } from './ImageEditSession';

const BASE = import.meta.env.VITE_API_BASE_URL;

async function request(path, body) {
  const response = await authFetch(`${BASE}${path}`, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {});
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

export async function apiSubmitImageEdit(source, options = {}) {
  const mode = options.edit_mode || options.mode;
  const id = source?.id;
  if (!id || /^(local[-_:]|blob:)/.test(id)) throw new Error('当前图片缺少真实源资产编号');
  const path = `/api/creation/images/${encodeURIComponent(id)}`;
  if (mode === 'multi_angle') {
    if (!options.internal_prompt?.trim()) throw new Error('缺少多机位编辑指令');
    const context = options.business_context || {};
    return request('/api/creation/images/generate', {
      edit_type: 'image_edit', edit_mode: 'multi_angle', source_asset_id: id,
      image: source.url, internal_prompt: options.internal_prompt.trim(),
      model: 'gpt-image-2', count: 1, multi_angle_options: options.multi_angle_options,
      business_context: { project_id: context.project_id, session_id: context.session_id, shot_id: context.shot_id },
      idempotency_key: options.idempotency_key,
      save_to_assets: true, inherit_project_style: false,
    });
  }
  if (mode === 'erase' || mode === 'inpaint') {
    if (!options.mask?.startsWith('data:image/png;base64,')) throw new Error('缺少有效的 PNG 编辑蒙版');
    if (mode === 'inpaint' && !options.prompt?.trim()) throw new Error('请输入重绘提示词');
    return request(`${path}/erase`, {
      mask_data_url: options.mask,
      model: 'gpt-image-2',
      ...(mode === 'inpaint' ? { prompt: options.prompt.trim() } : {}),
    });
  }
  if (mode === 'upscale') {
    if (!['2K', '3K', '4K'].includes(options.target_resolution)) throw new Error('请选择有效的超清画质');
    return request(`${path}/upscale`, { resolution: options.target_resolution, model: 'doubao-seedream-5.0-lite' });
  }
  if (mode === 'outpaint') {
    const expansion = options.expandOptions || options;
    validateExpansion(expansion);
    if (!source.url) throw new Error('未找到可用原图');
    const context = options.business_context || {};
    return request('/api/creation/images/generate', {
      prompt: options.prompt?.trim() || '', model: 'image-kling-v3', count: 1,
      generation_mode: 'outpainting',
      expand_options: Object.fromEntries(['up', 'down', 'left', 'right'].map((side) => [`${side}_expansion_ratio`, expansion[`${side}_expansion_ratio`]])),
      reference_images: [source.url],
      project_id: context.project_id, session_id: context.session_id, shot_id: context.shot_id,
      save_to_assets: true, inherit_project_style: false,
    });
  }
  throw new Error('该编辑模式尚未接入，未提交生成');
}

export async function apiResolveImageEdit(accepted, mode, options) {
  const checkSession = options?.checkSession || imageEditSessionCheck();
  checkSession();
  const taskId = accepted.task_id || accepted.taskId;
  if (!taskId && mode !== 'outpaint') return accepted;
  const id = taskId || accepted.id;
  if (!id) throw new Error('生成服务未返回任务编号');
  const task = await waitForImageEditTask(id, { ...options, checkSession });
  checkSession();
  const result = task.results?.find((item) => item.success !== false && item.asset_id);
  const image = task.images?.[0];
  const assetId = result?.asset_id || image?.asset_id || image?.id || task.resource_ids?.[0];
  if (!assetId) throw new Error('任务结束但未返回可用图片资产，请继续读取原任务');
  const edited = await apiReadEditedImage(assetId);
  checkSession();
  return edited;
}

export function normalizeEditedImage(image) {
  const remoteUrl = image.original_url || image.originalUrl;
  const creationAssetId = image.asset_id || image.id;
  if (!remoteUrl || !creationAssetId) throw new Error('编辑结果缺少原图或资产编号');
  return { ...readEditMetadata(image), metadata_json: image.metadata_json, remoteUrl, originalUrl: remoteUrl, creationAssetId, backendId: creationAssetId, model: image.model, prompt: mayShowEditPrompt(image) ? image.prompt : '', ratio: image.aspect_ratio, resolution: image.resolution, source: 'backend-image-edit' };
}
