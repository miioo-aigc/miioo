import { authFetch } from './request';
import { throwResponseError } from './error';
import { displayRatio } from '../utils/CompositionTransform';
const BASE = import.meta.env.VITE_API_BASE_URL || '';

export async function apiCompositionPreview(assetId, { signal, create = false } = {}) {
  const response = await authFetch(`${BASE}/api/assets/${encodeURIComponent(assetId)}/composition-preview`, {
    method: create ? 'POST' : 'GET', signal,
    ...(create ? { headers: { 'Content-Type': 'application/json' }, body: '{}' } : {}),
  });
  if (!response.ok) await throwResponseError(response, '预览视频暂不可用');
  const data = await response.json();
  if (String(data.asset_id) !== String(assetId) || data.asset_type !== 'video' || !data.source_version || !displayRatio(data.source)) {
    throw new Error('预览元数据无效');
  }
  const preview = data.preview;
  if (!['pending', 'processing', 'ready', 'failed'].includes(preview?.status)) throw new Error('预览状态无效');
  if (preview.status === 'ready' && (!preview.url || !displayRatio(preview)
    || Math.abs(displayRatio(preview) / displayRatio(data.source) - 1) > 0.000001)) {
    throw new Error('预览视频与原视频显示比例不一致');
  }
  return data;
}
