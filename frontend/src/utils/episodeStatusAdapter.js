/**
 * @file episodeStatusAdapter.js
 * @structure-index
 *
 * 将剧集概览或剧集状态转换为首页状态映射；不读取 React 状态、不调用 API。
 */

import { episodeDisplayStatus } from './EpisodeEditingProgress.js';

// 按分集 ID 对齐概览，分集列表中的状态优先；概览仅补充分镜数量。
export function buildEpisodeStatusMap(overview, episodes = []) {
  const progress = overview?.episode_progress || [];
  if (!episodes.length) return Object.fromEntries(progress.map((item, index) => [index, episodeDisplayStatus(item)]));
  const byId = new Map(progress.map(item => [String(item.episode_id), item]));
  return Object.fromEntries(episodes.map((episode, index) => [index, episodeDisplayStatus({ ...byId.get(String(episode.id)), ...episode })]));
}
