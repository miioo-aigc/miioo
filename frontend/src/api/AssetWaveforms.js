import { authFetch } from './request.js';
import { throwResponseError } from './error.js';
const BASE = import.meta.env.VITE_API_BASE_URL || '';
const STATUSES = new Set(['ready', 'pending', 'failed', 'missing_source', 'no_audio', 'unsupported']);

export function normalizeAssetWaveform(data) {
  const peaks = data?.peaks;
  const duration = data?.duration_seconds;
  const valid = Array.isArray(peaks) && peaks.length > 0 && peaks.every((p) => typeof p === 'number' && Number.isFinite(p) && p >= 0 && p <= 1)
    && typeof duration === 'number' && Number.isFinite(duration) && duration > 0;
  const status = STATUSES.has(data?.status) ? data.status : 'failed';
  return { status: status === 'ready' && !valid ? 'failed' : status,
    peaks: valid && status === 'ready' ? peaks : [], duration: valid ? duration : 0, version: data?.version };
}

async function request(assetId, retry, signal) {
  if (typeof assetId !== 'string' || !assetId.trim()) throw new Error('素材编号缺失');
  const response = await authFetch(BASE + '/api/assets/' + encodeURIComponent(assetId) + (retry ? '/ensure-media-derivatives' : '/waveform'),
    { method: retry ? 'POST' : 'GET', signal });
  if (!response.ok) await throwResponseError(response, '读取波形失败');
  return retry ? null : normalizeAssetWaveform(await response.json());
}
export const apiGetAssetWaveform = (id, signal) => request(id, false, signal);
export const apiEnsureAssetWaveform = (id, signal) => request(id, true, signal);
