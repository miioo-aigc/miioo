/** 分集状态是剪辑权限与卡片进度的唯一依据；generated 仅是历史展示名。 */
export function isEpisodeEditingUnlocked(episode) {
  return ['editing', 'edited'].includes(String(episode?.status || '').toLowerCase());
}
export function episodeDisplayStatus(episode) {
  const status = String(episode?.status || '').toLowerCase();
  if (status === 'edited') return 'edited';
  if (status === 'editing') return 'generated';
  if (['storyboarded', 'generated', 'videos_ready', 'no_image', 'images_ready'].includes(status)
    || Number(episode?.storyboard_count ?? episode?.storyboardCount) > 0) return 'storyboarded';
  return 'pending';
}
export function resolveEpisodeSteps(steps, episodes) {
  const next = new Set(steps);
  next.delete('edit');
  if (episodes.some(isEpisodeEditingUnlocked)) next.add('edit');
  if (episodes.some(episode => episodeDisplayStatus(episode) !== 'pending')) {
    next.add('subject');
    next.add('storyboard');
  }
  return next;
}
