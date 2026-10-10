import { authFetch } from './request';
import { getDisplayErrorMessage } from './error';
import { waitForImageEditTask } from './ImageEditTasks';
import { validateSourceAsset } from '../utils/MediaEditRequest';

const BASE = import.meta.env.VITE_API_BASE_URL;

export function videoEditPayload(options) {
  if (options.mode === 'subtitle_remove') {
    if (!Number.isFinite(options.duration) || options.duration <= 0) throw new Error('尚未读取到视频时长，请稍后重试');
    if (options.duration < 3) throw new Error('去字幕要求源视频至少3秒（上游限制）');
    const { x, y, width, height } = options.region || {};
    if (![x, y, width, height].every(Number.isFinite)
      || x < 0 || y < 0 || x > 1 || y > 1 || width <= 0 || height <= 0 || width > 1 || height > 1
      || x + width > 1 + 1e-6 || y + height > 1 + 1e-6) {
      throw new Error('字幕区域无效，请在视频画面内重新调整');
    }
    return { endpoint: 'subtitle-remove', body: { model: 'happyhorse-1.0-video-edit', region: { x, y, width, height } } };
  }
  if (options.mode === 'frame_extract') {
    if (!Number.isFinite(options.timestamp) || options.timestamp < 0) throw new Error('未找到有效的选帧时间');
    return { endpoint: 'extract-frame', body: { timestamp: options.timestamp, format: 'png' } };
  }
  if (options.mode === 'trim') {
    const { start_time, end_time, duration } = options;
    if (![start_time, end_time, duration].every(Number.isFinite) || start_time < 0 || end_time > duration || end_time - start_time < 0.1 - 1e-8) throw new Error('请选择至少0.1秒且不超出原视频的剪辑区间');
    if (end_time - start_time > 600) throw new Error('单段剪辑不能超过600秒');
    return { endpoint: 'trim', body: { start_time, end_time } };
  }
  if (options.mode === 'upscale') {
    const minimum = { '1080P': 3, '4K': 2 }[options.resolution];
    if (!minimum) throw new Error('请选择1080P或4K画质');
    if (!Number.isFinite(options.duration) || options.duration <= 0) throw new Error('尚未读取到视频时长，请稍后重试');
    if (options.duration < minimum) throw new Error(`${options.resolution}超清要求源视频至少${minimum}秒，当前约${options.duration.toFixed(2)}秒`);
    return { endpoint: 'upscale', body: { resolution: options.resolution, model: options.resolution === '1080P' ? 'happyhorse-1.0-video-edit' : 'doubao-seedance-2.0' } };
  }
  throw new Error('该视频编辑功能暂未接入');
}

export async function submitVideoEdit(source, options) {
  const id = validateSourceAsset(source);
  const { endpoint, body } = videoEditPayload(options);
  const response = await authFetch(`${BASE}/api/creation/videos/${encodeURIComponent(id)}/${endpoint}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw Object.assign(new Error(getDisplayErrorMessage(data, `视频编辑失败（${response.status}）`)), {
    rejected: (response.status >= 400 && response.status < 500)
      || (endpoint === 'subtitle-remove' && response.status === 501)
      || (endpoint === 'upscale' && response.status === 503 && String(data.detail).includes('编排')),
  });
  if (response.status === 202) {
    const taskId = data.task_id || data.taskId || data.id;
    if (!taskId) throw new Error('后端已受理但未返回任务编号，请核查任务，不要重复提交');
    return { ...data, task_id: taskId };
  }
  return data;
}

export async function resolveVideoEdit(accepted, mode) {
  const taskId = accepted.task_id || accepted.taskId;
  let result = accepted;
  if (taskId) {
    const task = await waitForImageEditTask(taskId, { mediaLabel: '视频' });
    const id = task.results?.find((item) => item.success !== false && item.asset_id)?.asset_id || task.resource_ids?.[0];
    if (!id) throw new Error('视频任务已结束，但未返回资产编号，请勿重复生成');
    const response = await authFetch(`${BASE}/api/creation/videos/${encodeURIComponent(id)}`);
    const data = await response.json();
    if (!response.ok) throw new Error(getDisplayErrorMessage(data, '读取生成视频失败，请重试读取原任务'));
    result = data;
  }
  const id = result.asset_id || result.assetId || result.id;
  const url = mode === 'frame_extract' ? result.original_url || result.originalUrl || result.image_url || result.imageUrl : result.video_url || result.videoUrl;
  if (!id || !url) throw new Error('后端已返回，但结果缺少资产编号或媒体地址，请核查资产库，不要重复提交');
  return { ...result, id, asset_id: id, ...(mode === 'frame_extract' ? { original_url: url } : { video_url: url }) };
}
