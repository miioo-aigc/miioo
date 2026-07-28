/**
 * @file episodeStatusAdapter.js
 * @structure-index
 *
 * 将剧集概览或剧集状态转换为首页状态映射；不读取 React 状态、不调用 API。
 */

const VALID_EPISODE_STATUSES = new Set(['edited', 'generated', 'storyboarded', 'pending']);

function toCount(value) {
  const count = Number(value);
  return Number.isFinite(count) && count > 0 ? count : 0;
}

function mapOverviewEpisodeStatus(episode) {
  const status = String(episode?.status || '').toLowerCase();
  const storyboardCount = toCount(episode?.storyboard_count ?? episode?.storyboardCount);

  // 视频生成数量不代表进入剪辑页；“剪辑中”由项目工作流解锁状态统一决定。
  if (status === 'edited') return 'edited';
  if (['videos_ready', 'no_image', 'images_ready'].includes(status) || storyboardCount > 0) return 'storyboarded';
  return 'pending';
}

function mapEpisodeListStatus(status) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'edited') return 'edited';
  if (['generated', 'videos_ready', 'storyboarded', 'no_image', 'images_ready'].includes(normalized)) return 'storyboarded';
  return 'pending';
}

export function buildEpisodeStatusMap(overview, episodes = []) {
  if (overview?.episode_progress?.length > 0) {
    return Object.fromEntries(overview.episode_progress.map((episode, index) => [
      index,
      mapOverviewEpisodeStatus(episode),
    ]));
  }

  if (episodes.length === 0) return {};
  return Object.fromEntries(episodes.map((episode, index) => [
    index,
    VALID_EPISODE_STATUSES.has(episode.status)
      ? episode.status
      : mapEpisodeListStatus(episode.status),
  ]));
}
