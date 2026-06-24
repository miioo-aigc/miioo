/**
 * 集数相关纯函数 / Pure episode utilities.
 * 无 React 依赖，任何模块均可安全引用。
 */

const EPISODE_ITEM_H = 36;
const EPISODE_MAX_VISIBLE = 10;

function getEpisodeLabel(ep) {
  if (!ep) return '';
  if (typeof ep === 'string') return ep;
  const label = ep.title || `第${ep.episode_number}集` || JSON.stringify(ep);
  return label.length > 20 ? label.slice(0, 20) + '\u2026' : label;
}

function getEpisodeId(ep) {
  if (!ep) return '';
  if (typeof ep === 'string') return ep;
  return ep.id ?? '';
}

export { EPISODE_ITEM_H, EPISODE_MAX_VISIBLE, getEpisodeLabel, getEpisodeId };
