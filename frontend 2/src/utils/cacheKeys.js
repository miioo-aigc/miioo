/**
 * 缓存键集中定义 + 分级 TTL 配置
 *
 * 所有缓存键在此统一管理，避免散落各处导致失效时遗漏。
 * 改动写操作时，对照本文件确认要 invalidate 哪些键。
 */

const HOUR = 60 * 60 * 1000;
const MIN = 60 * 1000;

// ── 分级 TTL 预设 ──────────────────────────────────────────────────────────────
export const TTL = {
  STATIC: 24 * HOUR,   // L1 静态配置：模型、风格、音色
  CONTENT: 5 * MIN,    // L2 项目内容：主体、剧集、分镜（SWR 兜底，主要靠失效）
  LIST: 1 * MIN,       // L3 列表：项目列表
};

// ── L1 静态配置（medium: 'local'，长缓存 + SWR）────────────────────────────────
export const K = {
  // 模型列表，按 category 区分
  models: (category) => `models:${category || 'all'}`,
  defaultModels: () => 'models:defaults',
  visualStyles: () => 'visual-styles',
  voiceLibrary: (params = {}) => `voices-library:${stable(params)}`,
  voices: (params = {}) => `voices:${stable(params)}`,
  officialVoices: (params = {}) => `voices-official:${stable(params)}`,
  cardVisibility: () => 'card-visibility',
  banner: () => 'banner',

  // ── L2 项目内容（medium: 'local'，SWR + 写失效）──────────────────────────────
  project: (id) => `project:${id}`,
  projectOverview: (id) => `overview:${id}`,
  subjects: (projectId, type, episodeId) => `subjects:${projectId}:${type || 'all'}:${episodeId || 'all'}`,
  subjectsPrefix: (projectId) => `subjects:${projectId}:`,
  episodes: (projectId) => `episodes:${projectId}`,
  script: (projectId) => `script:${projectId}`,
  storyboards: (projectId, episodeId) => `storyboards:${projectId}:${episodeId || 'all'}`,
  storyboardsPrefix: (projectId) => `storyboards:${projectId}:`,

  // ── L3 列表（medium: 'session'，短缓存）─────────────────────────────────────
  projects: (search) => `projects:${search || ''}`,
  projectsPrefix: () => 'projects:',

  // ── L2 资产库（medium: 'local'，SWR + 写失效）────────────────────────────────
  projectAssets: (projectId) => `project-assets:${projectId}`,
  projectAssetsPrefix: () => 'project-assets:',
};

// 将参数对象序列化为稳定字符串（键排序，保证同参命中同缓存）
function stable(obj) {
  const keys = Object.keys(obj).filter((k) => obj[k] != null).sort();
  if (keys.length === 0) return '_';
  return keys.map((k) => `${k}=${obj[k]}`).join('&');
}

// ── 介质预设：每个键族对应的存储介质 ────────────────────────────────────────────
export const MEDIUM = {
  STATIC: 'local',    // L1
  CONTENT: 'local',   // L2
  LIST: 'session',    // L3
};
