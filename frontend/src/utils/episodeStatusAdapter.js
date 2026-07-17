/**
 * @file episodeStatusAdapter.js
 * @structure-index
 *
 * 将剧集概览或剧集状态转换为首页状态映射；不读取 React 状态、不调用 API。
 */

const VALID_EPISODE_STATUSES = new Set(['edited', 'generated', 'pending']);

export function buildEpisodeStatusMap(overview, episodes = []) {
  if (overview?.episode_progress?.length > 0) {
    return Object.fromEntries(overview.episode_progress.map((episode, index) => [
      index,
      episode.video_generated_count > 0 ? 'generated' : 'pending',
    ]));
  }

  if (episodes.length === 0) return {};
  return Object.fromEntries(episodes.map((episode, index) => [
    index,
    VALID_EPISODE_STATUSES.has(episode.status) ? episode.status : 'pending',
  ]));
}
