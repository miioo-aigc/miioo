/** 待后端补齐：分集进入剪辑的幂等推进接口，契约见后端交付文档。 */
import { authFetch } from './request';
import { throwResponseError } from './error';
import { invalidate } from '../utils/cache';
import { K } from '../utils/cacheKeys';
import { isEpisodeEditingUnlocked } from '../utils/EpisodeEditingProgress';

export async function apiStartEpisodeEditing(projectId, episodeId) {
  if (!projectId || !episodeId) throw new Error('请先选择分集');
  const response = await authFetch(import.meta.env.VITE_API_BASE_URL + '/api/projects/' + encodeURIComponent(projectId) + '/episodes/' + encodeURIComponent(episodeId) + '/start-edit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  if (!response.ok) await throwResponseError(response, '分集剪辑进度保存失败，请重试');
  const episode = await response.json();
  if (String(episode?.id) !== String(episodeId) || String(episode?.project_id) !== String(projectId) || !isEpisodeEditingUnlocked(episode)) {
    throw new Error('服务器未确认该分集的剪辑状态，请刷新后重试');
  }
  invalidate(K.episodes(projectId));
  invalidate(K.projectOverview(projectId));
  return episode;
}
