import { getVisualStyle } from './visualStyles';

/**
 * 项目选项展示名称适配
 *
 * 接口和项目状态保留稳定的英文枚举值，页面展示使用产品中文名称。
 */
const VISUAL_STYLE_LABELS = {
  custom: '自定义',
  'xianxia-3d': '3D国漫仙侠',
  'suspense-anime-2d': '2D悬疑恐怖',
  'cyberpunk-3d': '3D赛博朋克',
  'ghibli-style': '宫崎骏风格',
  'shinkai-style': '新海诚风格',
  'ancient-chinese-live-action': '3D国风正剧',
  'magic-epic-3d': '3D魔幻史诗',
  'pixar-style': '3D Q版',
  'wuxia-cg': '武侠CG',
  'jpkr-2d': '日韩二次元',
  'ink-guofeng-2d': '2D写意古风',
  'dark-gothic-2d': '暗黑哥特',
  'live-action-gufeng': '古风写实',
  'urban-emotion': '都市情感',
  'xianxia-fantasy': '仙侠玄幻',
  'live-action-horror': '悬疑恐怖',
  'post-apocalyptic-modern': '末日废土',
  'realistic-era': '写实年代剧',
  'future-scifi': '未来科幻',
  'urban-workplace': '都市职场',
  'wuxia-war': '武侠战争',
  'rural-style': '乡土风格',
  'live-action-suspense': '真人悬疑',
};

const CREATION_TYPE_LABELS = {
  dialogue: '剧情对白',
  narration: '旁白解说',
};

export function getVisualStyleLabel(value) {
  const visualStyle = getVisualStyle(value);
  if (visualStyle) return visualStyle.label;
  return VISUAL_STYLE_LABELS[value] || value || '';
}

export function getCreationTypeLabel(value) {
  return CREATION_TYPE_LABELS[value] || value || '';
}
