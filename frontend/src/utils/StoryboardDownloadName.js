import { areStoryboardMediaSame, storyboardMediaType } from './storyboardMediaDedup.js';

function filenamePart(value, fallback) {
  // 文件名必须去除控制字符。
  // eslint-disable-next-line no-control-regex
  return String(value ?? '').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').trim().replace(/[. ]+$/g, '') || fallback;
}

/** 序号按当前候选视频的展示顺序计算，图片不占号；下载时固定名称。 */
export function storyboardVideoDownloadName({ projectName, episode, shot, media, candidates }) {
  const videos = candidates.filter((item) => storyboardMediaType(item) === 'video');
  const index = videos.findIndex((item) => item === media || areStoryboardMediaSame(item, media));
  if (index < 0) throw new Error('未找到视频在分镜候选列表中的位置，请刷新后重试');
  const episodeName = typeof episode === 'string' ? episode : episode?.title || (episode?.episode_number != null ? `第${episode.episode_number}集` : '未命名分集');
  const number = String(shot.number ?? '').replace(/^分镜/, '').replace(/^0+(?=\d)/, '').padStart(2, '0');
  return `${filenamePart(projectName, '未命名项目')}-${filenamePart(episodeName, '未命名分集')}-分镜${filenamePart(number, '00')}-${String(index + 1).padStart(2, '0')}.mp4`;
}
