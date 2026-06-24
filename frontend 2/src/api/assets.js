const BASE = import.meta.env.VITE_API_BASE_URL;

import { authFetch } from './request.js';
import { normalizeImageUrl } from '../utils/imageUrl.js';
import { apiGetStoryboards } from './storyboard.js';
import { cached, invalidate } from '../utils/cache.js';
import { K, TTL, MEDIUM } from '../utils/cacheKeys.js';

function invalidateProjectAssetDependents(projectId) {
  if (!projectId) return;
  invalidate(K.subjectsPrefix(projectId));
  invalidate(K.storyboardsPrefix(projectId));
  invalidate(K.projectOverview(projectId));
  invalidate(K.projectAssets(projectId), MEDIUM.CONTENT);
}

/**
 * 资产列表（支持多维过滤）
 * @param {object} filters - { project_id, scope, asset_type, category, is_starred, is_primary, search, include_deleted, deleted_only, limit, offset, cursor }
 * @returns {Promise<Array>} 资产数组
 */
export async function apiGetAssets(filters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') params.append(k, v);
  });
  const query = params.toString();
  const url = query ? `${BASE}/api/assets?${query}` : `${BASE}/api/assets`;
  const res = await authFetch(url, { headers: { 'Content-Type': 'application/json' } });
  const data = await res.json();
  // 后端返回 AssetListResponse: { list: [...], total, has_more, limit, offset, next_cursor }
  // 统一提取 list 字段，兼容旧版直接返回数组的情况
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.list)) return data.list;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

// 带分页信息的资产请求，返回 { list, nextCursor, hasMore, total }
export async function apiGetAssetsPage(filters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') params.append(k, v);
  });
  const query = params.toString();
  const url = query ? `${BASE}/api/assets?${query}` : `${BASE}/api/assets`;
  const res = await authFetch(url, { headers: { 'Content-Type': 'application/json' } });
  const data = await res.json();
  if (Array.isArray(data)) return { list: data, nextCursor: null, hasMore: false, total: data.length };
  const list = data?.list ?? data?.items ?? data?.data ?? [];
  return {
    list,
    nextCursor: data?.next_cursor ?? data?.nextCursor ?? null,
    hasMore: data?.has_more ?? data?.hasMore ?? false,
    total: data?.total ?? list.length,
  };
}

export async function apiGetAssetDetail(assetId) {
  const res = await authFetch(`${BASE}/api/assets/${assetId}`, {
    headers: { 'Content-Type': 'application/json' },
  });
  return res.json();
}

export async function apiCreateAsset(data) {
  const res = await authFetch(`${BASE}/api/assets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function apiUpdateAsset(assetId, updates) {
  const res = await authFetch(`${BASE}/api/assets/${assetId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  return res.json();
}

export async function apiDeleteAsset(assetId, { projectId } = {}) {
  await authFetch(`${BASE}/api/assets/${assetId}`, { method: 'DELETE' });
  invalidateProjectAssetDependents(projectId);
}

export async function apiBatchDeleteAssets(asset_ids, { projectId } = {}) {
  await authFetch(`${BASE}/api/assets/batch-delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ asset_ids }),
  });
  invalidateProjectAssetDependents(projectId);
}

export async function apiBatchRestoreAssets(asset_ids) {
  await authFetch(`${BASE}/api/assets/restore`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ asset_ids }),
  });
}

export async function apiRestoreAsset(assetId) {
  const res = await authFetch(`${BASE}/api/assets/${assetId}/restore`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  return res.json();
}

export async function apiExtractAssetFrame(assetId, { position }) {
  const res = await authFetch(`${BASE}/api/assets/${assetId}/extract-frame`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ position }),
  });
  return res.json();
}

export async function apiDownloadAsset(assetId, { prefer_origin } = {}) {
  const params = new URLSearchParams();
  if (prefer_origin !== undefined) params.append('prefer_origin', prefer_origin);
  const query = params.toString();
  const url = query ? `${BASE}/api/assets/${assetId}/download?${query}` : `${BASE}/api/assets/${assetId}/download`;
  const res = await authFetch(url, { headers: { 'Content-Type': 'application/json' } });
  return res.blob();
}

// ── 项目资产（按 tab key 分组） ────────────────────────────────────────────────

const CATEGORY_TO_TAB = {
  character: 'chars',
  scene: 'scenes',
  prop: 'props',
  audio: 'audio',
  film: 'final',
};

function normalizeAsset(item) {
  const meta = (item.metadata_json) || {};
  const isVideo = item.asset_type === 'video';
  return {
    id: item.id,
    name: item.name,
    // 视频资产：url 只用缩略图，不 fallback 到视频地址（避免图片标签加载视频）
    url: isVideo
      ? (normalizeImageUrl(item.thumbnail_url || meta.thumbnail_url) || null)
      : (normalizeImageUrl(item.thumbnail_url || item.file_url) || null),
    fileUrl: normalizeImageUrl(item.file_url) || null,
    videoUrl: isVideo ? (normalizeImageUrl(item.file_url) || null) : null,
    // 媒体分层字段（方案A）
    previewUrl: isVideo
      ? null
      : (normalizeImageUrl(item.preview_url || item.previewUrl || item.file_url) || null),
    downloadUrl: item.download_url || item.downloadUrl || item.file_url || null,
    posterUrl: isVideo ? (normalizeImageUrl(item.poster_url || item.posterUrl) || null) : null,
    previewVideoUrl: isVideo
      ? (normalizeImageUrl(item.preview_video_url || item.previewVideoUrl || item.file_url) || null)
      : null,
    previewReady: item.preview_ready ?? item.previewReady ?? false,
    largeUrl: !isVideo ? (normalizeImageUrl(item.large_url || item.largeUrl) || null) : null,
    starred: item.is_starred ?? false,
    description: item.description ?? '',
    prompt: item.prompt ?? '',
    model: item.model ?? '',
    ratio: item.ratio || meta.ratio || '',
    resolution: item.resolution ?? meta.resolution ?? item.size ?? '',
    size: item.size ?? '',
    created_at: item.created_at ?? '',
    is_primary: item.is_primary ?? false,
    subject_id: item.subject_id ?? null,
    // 分镜专用字段
    shot_number: meta.shot_number ?? null,
    storyboard_id: meta.storyboard_id ?? null,
    episode_number: meta.episode_number ?? null,
    // 分集展示字段（用于区分不同集的同编号分镜，避免跨集合并）
    episodeLabel: item.episode_label ?? item.episodeLabel ?? meta.episode_label ?? null,
    duration: meta.duration ?? item.duration ?? null,
    refImages: (Array.isArray(item.ref_images) ? item.ref_images : []).map(img => ({
      url: normalizeImageUrl(img.url || img.file_url || ''),
      title: img.title || img.name || '',
    })).filter(img => img.url),
  };
}

/**
 * 按主体(subject_id 或 name)分组，生成聚合卡片
 */
function groupBySubject(normalized) {
  const subjectMap = {};

  normalized.forEach((asset) => {
    const key = asset.subject_id || asset.name;
    if (!subjectMap[key]) subjectMap[key] = [];
    subjectMap[key].push(asset);
  });

  return Object.entries(subjectMap).map(([key, images]) => {
    const primaryIdx = images.findIndex((img) => img.is_primary);
    const primaryImage = primaryIdx >= 0 ? images[primaryIdx] : images[0];
    const sorted = [
      ...images.filter((img) => img.is_primary),
      ...images.filter((img) => !img.is_primary),
    ];

    return {
      id: primaryImage.id,
      subject_id: primaryImage.subject_id ?? (key !== primaryImage.name ? key : null),
      name: primaryImage.name,
      description: primaryImage.description,
      url: primaryImage.url,
      fileUrl: primaryImage.fileUrl,
      videoUrl: primaryImage.videoUrl ?? null,
      images: sorted,
      imageCount: images.length,
      prompt: primaryImage.prompt,
      model: primaryImage.model,
      ratio: primaryImage.ratio,
      resolution: primaryImage.resolution,
      created_at: primaryImage.created_at,
    };
  });
}

/**
 * 按分镜编号(shot_number + storyboard_id + episode_number)分组，用于分镜图/视频
 * episode_number 纳入 key，确保不同集的同编号分镜不会被合并到同一卡片
 */
function groupByShot(normalized) {
  const shotMap = {};

  normalized.forEach((asset) => {
    // key 加入 episode_number（优先）或 episodeLabel（兜底），避免第一集分镜01和第二集分镜01被合并
    // episode_number 存在于 metadata_json，后端未必写入；episodeLabel 是 AssetResponse 顶层字段，更可靠
    const epKey = asset.episode_number ?? asset.episodeLabel ?? 'x';
    const key = asset.shot_number != null
      ? `ep${epKey}_${asset.storyboard_id ?? 'local'}_shot_${asset.shot_number}`
      : asset.name;
    if (!shotMap[key]) shotMap[key] = [];
    shotMap[key].push(asset);
  });

  return Object.entries(shotMap).map(([key, images]) => {
    const primaryIdx = images.findIndex((img) => img.is_primary);
    const primaryImage = primaryIdx >= 0 ? images[primaryIdx] : images[0];
    const sorted = [
      ...images.filter((img) => img.is_primary),
      ...images.filter((img) => !img.is_primary),
    ];

    // 显示名称：有 episodeLabel 时拼上集数前缀，否则用"分镜-N"
    let displayName;
    if (primaryImage.shot_number != null) {
      const shotStr = String(primaryImage.shot_number).padStart(2, '0');
      const prefix = primaryImage.episodeLabel ? `${primaryImage.episodeLabel}-` : '';
      displayName = `${prefix}分镜${shotStr}`;
    } else {
      displayName = primaryImage.name;
    }

    return {
      id: primaryImage.id,
      name: displayName,
      description: primaryImage.description,
      url: primaryImage.url,
      fileUrl: primaryImage.fileUrl,
      videoUrl: primaryImage.videoUrl ?? null,
      images: sorted,
      imageCount: images.length,
      prompt: primaryImage.prompt,
      model: primaryImage.model,
      ratio: primaryImage.ratio || sorted.find(i => i.ratio)?.ratio || '',
      resolution: primaryImage.resolution,
      duration: primaryImage.duration,
      created_at: primaryImage.created_at,
      shot_number: primaryImage.shot_number,
      storyboard_id: primaryImage.storyboard_id,
      episode_number: primaryImage.episode_number,
      episodeLabel: primaryImage.episodeLabel,
    };
  }).sort((a, b) => {
    // 先按集数排序，再按 shot_number 排序，无编号的排最后
    // episode_number（metadata_json）优先；后端若未写则从 episodeLabel 提取集序号兜底
    const CN = { '零':0,'一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9 };
    const chineseToNum = (s) => {
      if (s === '十') return 10;
      if (s.startsWith('十')) return 10 + (CN[s[1]] ?? 0);
      if (s.endsWith('十')) return (CN[s[0]] ?? 0) * 10;
      if (s.length === 3 && s[1] === '十') return (CN[s[0]] ?? 0) * 10 + (CN[s[2]] ?? 0);
      return CN[s] ?? null;
    };
    const epNumFromLabel = (label) => {
      if (label == null) return null;
      // 阿拉伯数字："第1集" → 1
      const arabic = String(label).match(/\d+/);
      if (arabic) return parseInt(arabic[0], 10);
      // 中文数字："第一集" → 1，"第十二集" → 12
      const chinese = String(label).match(/[零一二三四五六七八九十百千]+/);
      if (chinese) return chineseToNum(chinese[0]);
      return null;
    };
    const epA = a.episode_number ?? epNumFromLabel(a.episodeLabel) ?? Infinity;
    const epB = b.episode_number ?? epNumFromLabel(b.episodeLabel) ?? Infinity;
    if (epA !== epB) return epA - epB;
    if (a.shot_number == null) return 1;
    if (b.shot_number == null) return -1;
    return a.shot_number - b.shot_number;
  });
}

function groupByCategory(list) {
  const grouped = { chars: [], scenes: [], props: [], storyboard_img: [], storyboard_video: [], audio: [], final: [] };

  // 先按 category 初步分类
  const byCategory = {};
  list.forEach((item) => {
    if (item.category === 'storyboard') {
      const tab = item.asset_type === 'video' ? 'storyboard_video' : 'storyboard_img';
      if (!byCategory[tab]) byCategory[tab] = [];
      byCategory[tab].push(item);
    } else {
      const tab = CATEGORY_TO_TAB[item.category];
      if (tab) {
        if (!byCategory[tab]) byCategory[tab] = [];
        byCategory[tab].push(item);
      }
    }
  });

  // 对 chars/scenes/props 进行主体分组，对 storyboard_img/storyboard_video 按镜头编号分组
  const SUBJECT_CATEGORIES = new Set(['chars', 'scenes', 'props']);
  const STORYBOARD_CATEGORIES = new Set(['storyboard_img', 'storyboard_video']);

  Object.entries(byCategory).forEach(([tab, items]) => {
    if (SUBJECT_CATEGORIES.has(tab)) {
      // 主体分组逻辑
      const normalized = items.map(normalizeAsset);
      grouped[tab] = groupBySubject(normalized);
    } else if (STORYBOARD_CATEGORIES.has(tab)) {
      // 分镜分组逻辑：按 shot_number 分组
      const normalized = items.map(normalizeAsset);
      grouped[tab] = groupByShot(normalized);
    } else {
      // 其他分类直接 normalize
      grouped[tab] = items.map(normalizeAsset);
    }
  });

  return grouped;
}

/**
 * 计算某个 tab 的 limit：根据视口可用区域 + 卡片尺寸算出足以铺满屏幕的条数
 * @param {string} category - tab key
 * @param {{ navW?: number, leftPanelW?: number, tabBarH?: number, toolbarH?: number }} opts
 */
export function calcProjectAssetsLimit(category, {
  navW = 48,          // PrimaryNav 宽度
  leftPanelW = 220,   // 项目列表侧边栏宽度
  tabBarH = 48,       // category tab 栏高度
  toolbarH = 48,      // 批量操作工具栏高度
  extraH = 0,         // 额外减去的高度（如顶栏）
} = {}) {
  const isSubject = ['chars', 'scenes', 'props'].includes(category);
  const isStoryboard = ['storyboard_img', 'storyboard_video'].includes(category);
  const isAudio = category === 'audio';

  if (isAudio) return 50; // 音频是列表布局，直接给个足够大的数

  const CARD_W = isSubject ? 200 : 320;
  const CARD_H = isSubject ? 246 : 180;
  const GAP = 8;
  const PAD_X = 24; // 左右各 24px

  const availW = window.innerWidth - navW - leftPanelW - PAD_X * 2;
  const availH = window.innerHeight - tabBarH - toolbarH - extraH;

  const cols = Math.max(1, Math.floor((availW + GAP) / (CARD_W + GAP)));
  const rows = Math.max(1, Math.ceil(availH / (CARD_H + GAP))) + 1; // +1 行缓冲

  return cols * rows;
}

// tab key → 后端 category / asset_type 过滤参数
const TAB_CATEGORY_FILTER = {
  chars:             { category: 'character' },
  scenes:            { category: 'scene' },
  props:             { category: 'prop' },
  storyboard_img:    { category: 'storyboard', asset_type: 'image' },
  storyboard_video:  { category: 'storyboard', asset_type: 'video' },
  audio:             { category: 'audio' },
  final:             { category: 'film' },
};

// 用 storyboard 数据给资产打 is_primary / ratio 标记，返回富化后的原始资产数组
async function enrichWithStoryboards(projectId, rawList, needsStoryboards) {
  if (!needsStoryboards) return rawList;
  const storyboardsRaw = await apiGetStoryboards(projectId).catch(() => []);
  const storyboards = Array.isArray(storyboardsRaw) ? storyboardsRaw : [];
  const primaryImageUrls = new Set();
  const primaryVideoAssetIds = new Set();
  const primaryVideoUrls = new Set();
  const videoAssetIdRatio = {};
  const videoUrlRatio = {};
  const imageUrlRatio = {};
  storyboards.forEach((sb) => {
    const ratio = sb.ratio || sb.aspect_ratio || '';
    if (sb.image_url) {
      primaryImageUrls.add(normalizeImageUrl(sb.image_url));
      if (ratio) imageUrlRatio[normalizeImageUrl(sb.image_url)] = ratio;
    }
    if (sb.video_asset_id) {
      primaryVideoAssetIds.add(sb.video_asset_id);
      if (ratio) videoAssetIdRatio[sb.video_asset_id] = ratio;
    } else if (sb.video_url) {
      primaryVideoUrls.add(normalizeImageUrl(sb.video_url));
      if (ratio) videoUrlRatio[normalizeImageUrl(sb.video_url)] = ratio;
    }
  });
  return rawList.map((item) => {
    if (item.category !== 'storyboard') return item;
    let is_primary = item.is_primary ?? false;
    let ratio = item.ratio || '';
    if (item.asset_type === 'video') {
      // 保留后端原始 is_primary，或通过 storyboard 交叉比对补充
      is_primary = is_primary || primaryVideoAssetIds.has(item.id) || primaryVideoUrls.has(normalizeImageUrl(item.file_url));
      if (!ratio) ratio = videoAssetIdRatio[item.id] || videoUrlRatio[normalizeImageUrl(item.file_url)] || '';
    } else {
      // 保留后端原始 is_primary，或通过 storyboard 交叉比对补充
      is_primary = is_primary || primaryImageUrls.has(normalizeImageUrl(item.file_url)) || primaryImageUrls.has(normalizeImageUrl(item.thumbnail_url));
      if (!ratio) ratio = imageUrlRatio[normalizeImageUrl(item.file_url)] || imageUrlRatio[normalizeImageUrl(item.thumbnail_url)] || '';
    }
    return { ...item, is_primary, ...(ratio ? { ratio } : {}) };
  });
}

// 导出 groupByCategory / enrichWithStoryboards 供调用方使用
export { groupByCategory, enrichWithStoryboards };

export async function apiGetProjectAssets(projectId, { limit, category } = {}) {
  const fetchFn = async () => {
    const categoryFilter = category ? (TAB_CATEGORY_FILTER[category] ?? {}) : {};
    const effectiveLimit = limit || 200;
    const needsStoryboards = category === 'storyboard_img' || category === 'storyboard_video' || !category;
    const rawList = await apiGetAssets({ project_id: projectId, scope: 'project', limit: effectiveLimit, ...categoryFilter });
    const enriched = await enrichWithStoryboards(projectId, Array.isArray(rawList) ? rawList : [], needsStoryboards);
    return groupByCategory(enriched);
  };

  // 指定 category 时跳过全局缓存（按分类局部请求）；有 limit 时也跳过缓存；否则走正常缓存路径
  if (limit || category) return fetchFn();
  return cached(K.projectAssets(projectId), fetchFn, { medium: MEDIUM.CONTENT, ttl: TTL.CONTENT });
}

/**
 * 带 cursor 分页的项目资产请求（按 tab category 单独拉取）
 * 返回 { grouped: { [tabKey]: [] }, rawList, nextCursor, hasMore }
 * rawList 是未分组的原始资产，调用方需自行累积后调用 groupByCategory 重新分组
 */
export async function apiGetProjectAssetsPage(projectId, { category, limit = 20, cursor } = {}) {
  const categoryFilter = category ? (TAB_CATEGORY_FILTER[category] ?? {}) : {};
  const needsStoryboards = category === 'storyboard_img' || category === 'storyboard_video' || !category;
  const page = await apiGetAssetsPage({
    project_id: projectId,
    scope: 'project',
    limit,
    cursor: cursor || undefined,
    ...categoryFilter,
  });
  const enriched = await enrichWithStoryboards(projectId, page.list, needsStoryboards);
  return {
    rawList: enriched,
    grouped: groupByCategory(enriched),
    nextCursor: page.nextCursor,
    hasMore: page.hasMore,
    total: page.total,
  };
}

export async function apiGetShotDetail(shotId) {
  const data = await apiGetAssetDetail(shotId);
  const meta = (data && data.metadata_json) || {};

  // 提取生成结果图片列表（metadata_json.outputs / variants / variations）
  const rawOutputs = meta.outputs || meta.variants || meta.variations;
  let images = [];
  if (Array.isArray(rawOutputs) && rawOutputs.length > 0) {
    images = rawOutputs.map((out, idx) => ({
      id: out.id || out.asset_id || `img_${idx}`,
      src: normalizeImageUrl(out.url || out.file_url || out.image_url || ''),
      finalized: !!(out.is_finalized != null ? out.is_finalized : (out.finalized ?? false)),
      prompt: out.prompt || '',
      model: out.model || '',
      resolution: out.resolution || out.size || '',
      generatedAt: out.created_at || '',
    }));
  } else {
    // 无量产结果时用主文件作为唯一图片
    images = [{
      id: `${data?.id || shotId}_0`,
      src: normalizeImageUrl(data?.file_url || data?.thumbnail_url || ''),
      finalized: true,
      prompt: data?.prompt || '',
      model: data?.model || '',
      resolution: data?.size || '',
      generatedAt: data?.created_at || '',
    }];
  }

  return {
    shotNumber: meta.shot_number ?? meta.shotNumber ?? data?.name ?? '',
    prompt: data?.prompt || '',
    model: data?.model || '',
    resolution: meta.resolution || data?.size || '',
    generatedAt: data?.created_at || '',
    images,
  };
}

export async function apiGetShotVideoDetail(shotId) {
  const data = await apiGetAssetDetail(shotId);
  return {
    shotNumber: data.shot_number ?? '',
    prompt: data.prompt ?? '',
    model: data.model ?? '',
    resolution: data.resolution ?? '',
    generatedAt: data.created_at ?? '',
    videoSrc: data.file_url ?? '',
    duration: data.duration ?? '',
    ratio: data.ratio ?? '',
    frames: [],
    ...data,
  };
}
