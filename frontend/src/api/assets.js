const BASE = import.meta.env.VITE_API_BASE_URL;

import { authFetch } from './request.js';
import { normalizeImageUrl } from '../utils/imageUrl.js';
import { apiGetStoryboards, apiListStoryboardMediaCandidates } from './storyboard.js';
import { cached, invalidate } from '../utils/cache.js';
import { K, TTL, MEDIUM } from '../utils/cacheKeys.js';

// subjectType 存在时只失效对应类别的主体缓存（'character'|'scene'|'prop'），
// 避免删除某一类资产时把三类主体缓存全部清掉。未知/未传时退回前缀失效（全部）。
function invalidateProjectAssetDependents(projectId, subjectType) {
  if (!projectId) return;
  if (subjectType) {
    invalidate(K.subjects(projectId, subjectType));
  } else {
    invalidate(K.subjectsPrefix(projectId));
  }
  invalidate(K.storyboardsPrefix(projectId));
  invalidate(K.storyboardPagePrefix(projectId));
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
  if (!res.ok) throw new Error(`获取资产列表失败（${res.status}）`);
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
  if (!res.ok) throw new Error(`获取资产分页失败（${res.status}）`);
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
  if (!res.ok) throw new Error(`更新资产失败（${res.status}）`);
  return res.json().catch(() => ({}));
}

/**
 * 获取绑定到指定主体的项目图片资产。
 * 主体候选图接口只覆盖 AI 主体生图记录，用户从候选区上传或选择的图片
 * 以普通项目资产保存，并通过 subject_id 关联主体，因此详情页需要合并读取。
 */
export async function apiGetSubjectAssets(projectId, subjectId, { category, limit = 200 } = {}) {
  if (!projectId || !subjectId) return [];
  const assets = await apiGetAssets({
    project_id: projectId,
    scope: 'project',
    asset_type: 'image',
    category,
    limit,
  });
  return (Array.isArray(assets) ? assets : []).filter((asset) => (
    String(asset?.subject_id ?? asset?.subjectId ?? '') === String(subjectId)
  ));
}

/**
 * 设置项目资产主体定稿图：先清理同一主体下其他定稿资产，再设置目标资产。
 * 资产接口目前不会自动保证 subject_id 范围内的 is_primary 唯一性，前端在写入前补齐该约束。
 */
export async function apiSetPrimarySubjectAsset(projectId, subjectId, assetId, { category } = {}) {
  const subjectAssets = await apiGetSubjectAssets(projectId, subjectId, { category });
  const otherPrimaryIds = subjectAssets
    .filter((asset) => String(asset?.id ?? asset?.asset_id) !== String(assetId) && asset?.is_primary)
    .map((asset) => asset.id ?? asset.asset_id)
    .filter(Boolean);

  await Promise.all(otherPrimaryIds.map((id) => apiUpdateAsset(id, { is_primary: false })));
  return apiUpdateAsset(assetId, { subject_id: subjectId, category, is_primary: true });
}

export async function apiDeleteAsset(assetId, { projectId, subjectType } = {}) {
  const res = await authFetch(`${BASE}/api/assets/${assetId}`, { method: 'DELETE' });
  if (!res.ok) {
    let detail = '';
    try {
      const payload = await res.json();
      detail = payload?.detail || payload?.message || '';
      if (typeof detail === 'object') detail = JSON.stringify(detail);
    } catch {
      // 非 JSON 错误响应不影响统一错误抛出
    }
    throw new Error(detail || `删除资产失败（${res.status}）`);
  }
  invalidateProjectAssetDependents(projectId, subjectType);
}

export async function apiBatchDeleteAssets(asset_ids, { projectId, subjectType } = {}) {
  const res = await authFetch(`${BASE}/api/assets/batch-delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ asset_ids }),
  });
  if (!res.ok) {
    let detail = '';
    try {
      const payload = await res.json();
      detail = payload?.detail || payload?.message || '';
      if (typeof detail === 'object') detail = JSON.stringify(detail);
    } catch {
      // 非 JSON 错误响应不影响统一错误抛出
    }
    throw new Error(detail || `批量删除资产失败（${res.status}）`);
  }
  invalidateProjectAssetDependents(projectId, subjectType);
}

const CREATION_SOURCE_VALUES = new Set([
  'creation',
  'created',
  'generated',
  'ai-generated',
  'aigenerated',
  'workbench',
]);

function getAssetMetadata(asset) {
  const metadata = asset?.metadata_json;
  if (!metadata) return {};
  if (typeof metadata === 'object') return metadata;
  try { return JSON.parse(metadata) || {}; } catch { return {}; }
}

function isCreationSource(value) {
  if (value == null) return false;
  const normalized = String(value).trim().toLowerCase().replace(/[_\s]/g, '-');
  return CREATION_SOURCE_VALUES.has(normalized)
    || normalized.includes('creation')
    || normalized.includes('generated');
}

function hasKnownAssetSource(asset) {
  const metadata = getAssetMetadata(asset);
  return [
    asset?.source,
    asset?.source_type,
    asset?.sourceType,
    metadata.source,
    metadata.source_type,
    metadata.sourceType,
    metadata.origin,
    metadata.origin_type,
    metadata.originType,
  ].some((value) => value != null && String(value).trim() !== '');
}

function getAssetId(asset) {
  return typeof asset === 'string' ? asset : asset?.id ?? asset?.asset_id ?? null;
}

function getSubjectId(asset) {
  return typeof asset === 'object' ? asset?.subject_id ?? asset?.subjectId ?? null : null;
}

function getAssetImageUrls(asset) {
  if (!asset || typeof asset !== 'object') return [];
  return [
    asset.file_url,
    asset.fileUrl,
    asset.original_url,
    asset.originalUrl,
    asset.download_url,
    asset.downloadUrl,
    asset.preview_url,
    asset.previewUrl,
    asset.large_url,
    asset.largeUrl,
    asset.thumbnail_url,
    asset.thumbnailUrl,
    asset.url,
  ].filter(Boolean);
}

async function getCreationAssetIds() {
  const ids = new Set();
  let cursor = null;
  let offset = 0;
  let previousCursor = null;

  for (let pageIndex = 0; pageIndex < 100; pageIndex += 1) {
    const page = await apiGetAssetsPage({
      scope: 'creation',
      limit: 200,
      ...(cursor ? { cursor } : offset > 0 ? { offset } : {}),
    });
    page.list.forEach((asset) => {
      const id = getAssetId(asset);
      if (id != null) ids.add(String(id));
    });

    const nextCursor = page.nextCursor || null;
    if (!page.hasMore || (nextCursor && nextCursor === previousCursor)) break;
    if (nextCursor) {
      previousCursor = nextCursor;
      cursor = nextCursor;
      continue;
    }
    if (page.list.length === 0) break;
    offset += page.list.length;
  }
  return ids;
}

function classifyAsset(asset, creationIds) {
  const metadata = getAssetMetadata(asset);
  const sourceValues = [
    asset?.source,
    asset?.source_type,
    asset?.sourceType,
    metadata.source,
    metadata.source_type,
    metadata.sourceType,
    metadata.origin,
    metadata.origin_type,
    metadata.originType,
  ];
  if (sourceValues.some(isCreationSource)) return 'creation';
  const id = getAssetId(asset);
  if (!hasKnownAssetSource(asset) && id != null && creationIds.has(String(id))) return 'creation';
  return 'owned';
}

function isAssetLibrarySource(asset) {
  const metadata = getAssetMetadata(asset);
  return [
    asset?.source,
    asset?.source_type,
    asset?.sourceType,
    metadata.source,
    metadata.source_type,
    metadata.sourceType,
    metadata.origin,
    metadata.origin_type,
    metadata.originType,
    asset?.detail_source,
    asset?.detailSource,
    metadata.detail_source,
    metadata.detailSource,
  ].some((value) => {
    if (value == null) return false;
    const normalized = String(value).trim().toLowerCase().replace(/[_\s]/g, '-');
    return normalized === 'asset-library'
      || normalized === 'asset-library-selection'
      || normalized === 'creation'
      || normalized === 'created'
      || normalized === 'generated'
      || normalized === 'ai-generated'
      || normalized.includes('asset-library');
  });
}

/**
 * 按来源移除资产：普通删除保留创作资产并解除主体引用；主体删除时统一删除绑定记录。
 * assetRecords 必须尽量传入完整资产记录，来源缺失时再查询创作资产集合兜底。
 */
export async function apiRemoveAssets(assetRecords = [], { projectId, subjectType, deleteMode = 'batch' } = {}) {
  const recordsById = new Map();
  assetRecords.forEach((asset) => {
    const id = getAssetId(asset);
    if (id != null && !recordsById.has(String(id))) recordsById.set(String(id), asset);
  });
  if (recordsById.size === 0) return { ownedIds: [], creationIds: [] };

  const records = [...recordsById.values()];
  const forceDelete = deleteMode === 'subject-delete';
  // 项目资产列表中的创作资产仍然保留创作资产本体，只是暂时带有 subject_id
  // 关联。项目资产删除不能因为 deleteMode === 'project' 就跳过来源识别，
  // 否则会把“主体绑定的创作图片”当成项目自有资产物理删除。
  const needsFallback = !forceDelete && records.some((asset) => !hasKnownAssetSource(asset));
  const creationAssetIds = needsFallback ? await getCreationAssetIds() : new Set();
  const ownedIds = [];
  const unboundIds = [];
  records.forEach((asset) => {
    const id = String(getAssetId(asset));
    // 主体页面本地上传/主体创作生成的资产，以及来源未知的主体图片，
    // 在项目资产中删除时直接删除源资产；只有明确识别为资产库选择的已有资产时才解绑。
    if (!forceDelete && deleteMode === 'project' && getSubjectId(asset) != null
      && !isAssetLibrarySource(asset)) ownedIds.push(id);
    else if (!forceDelete && (deleteMode === 'project' && getSubjectId(asset) != null
      || classifyAsset(asset, creationAssetIds) === 'creation')) unboundIds.push(id);
    else ownedIds.push(id);
  });

  if (ownedIds.length > 0) {
    if (deleteMode === 'single' || forceDelete) {
      // 主体删除走逐条接口。批量接口是资产中心的聚合能力，部分主体生成资产
      // 在批量处理时会触发后端关联校验并返回 500；逐条删除与资产详情接口契约一致。
      for (const id of ownedIds) {
        await apiDeleteAsset(id, { projectId, subjectType });
      }
    } else {
      await apiBatchDeleteAssets(ownedIds, { projectId, subjectType });
    }
  }
  if (unboundIds.length > 0) {
    await Promise.all(unboundIds.map((id) => apiUpdateAsset(id, { subject_id: null })));
  }
  invalidateProjectAssetDependents(projectId, subjectType);
  return { ownedIds, creationIds: unboundIds, unboundIds };
}

/**
 * 删除主体记录前，先处理项目中仍绑定该主体的候选资产。
 *
 * 参考图虽然可能被后端同时挂上 subject_id，但它只是主体与资产的引用关系，
 * 不能作为主体候选资产物理删除；调用方传入参考图资产 ID/地址后，这里会明确排除。
 */
export async function apiDeleteSubjectAssets(
  projectId,
  subjectId,
  { excludedAssetIds = [], excludedAssetUrls = [], subjectType } = {},
) {
  if (!projectId || subjectId == null) return { ownedIds: [], creationIds: [] };
  const excludedIds = new Set((Array.isArray(excludedAssetIds) ? excludedAssetIds : [])
    .filter(Boolean).map((id) => String(id)));
  const excludedUrls = new Set((Array.isArray(excludedAssetUrls) ? excludedAssetUrls : [])
    .filter(Boolean).map((url) => normalizeImageUrl(url) || String(url)));
  const records = [];
  let cursor = null;
  let offset = 0;
  let previousCursor = null;

  for (let pageIndex = 0; pageIndex < 100; pageIndex += 1) {
    const page = await apiGetAssetsPage({
      project_id: projectId,
      scope: 'project',
      limit: 200,
      ...(cursor ? { cursor } : offset > 0 ? { offset } : {}),
    });
    records.push(...page.list.filter((asset) => {
      if (String(asset.subject_id ?? asset.subjectId) !== String(subjectId)) return false;
      const assetId = getAssetId(asset);
      const assetUrls = getAssetImageUrls(asset);
      return !excludedIds.has(String(assetId))
        && !assetUrls.some((url) => excludedUrls.has(normalizeImageUrl(url) || String(url)));
    }));

    const nextCursor = page.nextCursor || null;
    if (!page.hasMore || (nextCursor && nextCursor === previousCursor)) break;
    if (nextCursor) {
      previousCursor = nextCursor;
      cursor = nextCursor;
      continue;
    }
    if (page.list.length === 0) break;
    offset += page.list.length;
  }

  if (records.length === 0) return { ownedIds: [], creationIds: [] };
  // 主体与资产库使用同一批资产记录。主体删除后这些记录不能继续以
  // “无主体的创作资产”留在资产库，否则资产选择弹窗和资产库会出现脏数据。
  return apiRemoveAssets(records, { projectId, subjectType, deleteMode: 'subject-delete' });
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
  const metadata = item.metadata_json;
  const meta = typeof metadata === 'string'
    ? (() => {
      try { return JSON.parse(metadata) || {}; } catch { return {}; }
    })()
    : (metadata || {});
  const isVideo = item.asset_type === 'video';
  return {
    id: item.id,
    assetType: item.asset_type ?? null,
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
    input_prompt: item.input_prompt ?? '',
    model: item.model ?? '',
    ratio: item.ratio || meta.ratio || '',
    resolution: item.resolution ?? meta.resolution ?? item.size ?? '',
    size: item.size ?? '',
    created_at: item.created_at ?? '',
    is_primary: item.is_primary ?? false,
    subject_id: item.subject_id ?? null,
    project_id: item.project_id ?? item.projectId ?? null,
    source: item.source ?? null,
    source_type: item.source_type ?? item.sourceType ?? null,
    metadata_json: metadata ?? null,
    // 分镜专用字段
    shot_number: meta.shot_number ?? null,
    storyboard_id: meta.storyboard_id ?? null,
    episode_number: meta.episode_number ?? null,
    // 分集展示字段（用于区分不同集的同编号分镜，避免跨集合并）
    episodeLabel: item.episode_label ?? item.episodeLabel ?? meta.episode_label ?? null,
    duration: meta.duration ?? item.duration ?? null,
    refImages: (() => {
      // API 返回 reference_image_urls (string[])，兼容旧字段 ref_images (object[])
      const raw = Array.isArray(item.reference_image_urls) ? item.reference_image_urls
        : Array.isArray(item.ref_images) ? item.ref_images
        : [];
      return raw.map(ref => {
        if (typeof ref === 'string') return { url: normalizeImageUrl(ref), title: '' };
        return {
          url: normalizeImageUrl(ref.url || ref.file_url || ''),
          title: ref.title || ref.name || '',
        };
      }).filter(img => img.url);
    })(),
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
      input_prompt: primaryImage.input_prompt ?? '',
     model: primaryImage.model,
      ratio: primaryImage.ratio,
      resolution: primaryImage.resolution,
      created_at: primaryImage.created_at,
      project_id: primaryImage.project_id,
      source: primaryImage.source,
      source_type: primaryImage.source_type,
      metadata_json: primaryImage.metadata_json,
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
      ? `ep${epKey}_${asset.storyboard_id ?? 'local'}_shot_${asset.shot_number}_${asset.assetType ?? 'asset'}`
      : asset.name;
    if (!shotMap[key]) shotMap[key] = [];
    shotMap[key].push(asset);
  });

  return Object.entries(shotMap).map(([, images]) => {
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
      assetType: primaryImage.assetType,
      images: sorted,
      imageCount: images.length,
      prompt: primaryImage.prompt,
      input_prompt: primaryImage.input_prompt ?? '',
      model: primaryImage.model,
      ratio: primaryImage.ratio || sorted.find(i => i.ratio)?.ratio || '',
      resolution: primaryImage.resolution,
      duration: primaryImage.duration,
      created_at: primaryImage.created_at,
      shot_number: primaryImage.shot_number,
      storyboard_id: primaryImage.storyboard_id,
      episode_number: primaryImage.episode_number,
      episodeLabel: primaryImage.episodeLabel,
      project_id: primaryImage.project_id,
      source: primaryImage.source,
      source_type: primaryImage.source_type,
      metadata_json: primaryImage.metadata_json,
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
  const grouped = { chars: [], scenes: [], props: [], storyboard: [], audio: [], final: [] };

  // 先按 category 初步分类
  const byCategory = {};
  list.forEach((item) => {
    if (item.category === 'storyboard') {
      const tab = 'storyboard';
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

  // 对 chars/scenes/props 进行主体分组，对 storyboard 按镜头编号和媒体类型分组
  const SUBJECT_CATEGORIES = new Set(['chars', 'scenes', 'props']);
  const STORYBOARD_CATEGORIES = new Set(['storyboard']);

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
  storyboard:        { category: 'storyboard' },
  audio:             { category: 'audio' },
  final:             { category: 'film' },
};

// 用 storyboard 数据给资产打 is_primary / ratio 标记，返回富化后的原始资产数组
async function enrichWithStoryboards(projectId, rawList, needsStoryboards) {
  if (!needsStoryboards) return rawList;
  const storyboardsRaw = await apiGetStoryboards(projectId).catch(() => []);
  const storyboards = Array.isArray(storyboardsRaw) ? storyboardsRaw : [];
  // 分镜页的定稿状态保存在每个镜头的候选媒体中，不能只依赖分镜主表的 image_url/video_url。
  // 这里批量读取候选列表，只收集已定稿媒体，保证资产选择弹窗的“仅显示定稿图”与分镜页一致。
  const finalizedCandidates = (await Promise.all(
    storyboards.map((storyboard) => apiListStoryboardMediaCandidates(projectId, storyboard.id).catch(() => [])),
  )).flat().filter((candidate) => candidate?.is_finalized === true || candidate?.isFinalized === true);
  const primaryAssetIds = new Set();
  const primaryImageUrls = new Set();
  const primaryVideoAssetIds = new Set();
  const primaryVideoUrls = new Set();
  const primaryMediaPathKeys = new Set();
  const videoAssetIdRatio = {};
  const videoUrlRatio = {};
  const imageUrlRatio = {};

  // 分镜接口在不同版本中可能返回资产 ID、原图 URL、缩略图 URL或嵌套媒体对象。
  // 统一收集这些关联键，避免资产列表因字段版本差异被“仅显示定稿图”误过滤。
  const addId = (value, target) => {
    if (value !== undefined && value !== null && value !== '') target.add(String(value));
  };
  const addUrl = (value, target) => {
    const normalized = normalizeImageUrl(value);
    if (normalized) target.add(normalized);
  };
  const getMediaPathKey = (value) => {
    const normalized = normalizeImageUrl(value);
    if (!normalized) return null;
    return normalized.split('?')[0].split('#')[0].replace(/^https?:\/\/[^/]+/i, '').replace(/^\/+/, '');
  };
  const addMediaPathKey = (value) => {
    const key = getMediaPathKey(value);
    if (key) primaryMediaPathKeys.add(key);
  };
  const getMediaValues = (sb, kind) => {
    const isImage = kind === 'image';
    const idKeys = isImage
      ? ['image_asset_id', 'imageAssetId', 'storyboard_image_asset_id', 'storyboardImageAssetId', 'image_id', 'imageId']
      : ['video_asset_id', 'videoAssetId', 'storyboard_video_asset_id', 'storyboardVideoAssetId', 'video_id', 'videoId'];
    const urlKeys = isImage
      ? ['image_url', 'imageUrl', 'image_file_url', 'imageFileUrl', 'image_thumbnail_url', 'imageThumbnailUrl', 'thumbnail_url', 'thumbnailUrl']
      : ['video_url', 'videoUrl', 'video_file_url', 'videoFileUrl', 'video_preview_url', 'videoPreviewUrl', 'preview_video_url', 'previewVideoUrl'];
    const media = isImage ? (sb.image || sb.storyboard_image) : (sb.video || sb.storyboard_video);
    const ids = idKeys.map((key) => sb[key]).concat(media && typeof media === 'object' ? [media.id, media.asset_id, media.assetId] : []);
    const urls = urlKeys.map((key) => sb[key]).concat(media && typeof media === 'object'
      ? [media.url, media.file_url, media.fileUrl, media.original_url, media.originalUrl, media.thumbnail_url, media.thumbnailUrl]
      : []);
    return { ids, urls };
  };

  storyboards.forEach((sb) => {
    const ratio = sb.ratio || sb.aspect_ratio || '';
    const imageMedia = getMediaValues(sb, 'image');
    const videoMedia = getMediaValues(sb, 'video');
    imageMedia.ids.forEach((value) => addId(value, primaryAssetIds));
    videoMedia.ids.forEach((value) => { addId(value, primaryAssetIds); addId(value, primaryVideoAssetIds); });
    imageMedia.urls.forEach((value) => {
      const normalized = normalizeImageUrl(value);
      addUrl(normalized, primaryImageUrls);
      addMediaPathKey(normalized);
      if (ratio && normalized) imageUrlRatio[normalized] = ratio;
    });
    videoMedia.ids.forEach((value) => {
      if (ratio) videoAssetIdRatio[String(value)] = ratio;
    });
    videoMedia.urls.forEach((value) => {
      const normalized = normalizeImageUrl(value);
      addMediaPathKey(normalized);
      if (ratio) videoUrlRatio[normalized] = ratio;
    });
  });
  finalizedCandidates.forEach((candidate) => {
    const mediaType = String(candidate.media_type ?? candidate.mediaType ?? candidate.type ?? '').toLowerCase();
    const isVideo = mediaType === 'video' || mediaType.startsWith('video/');
    const candidateMetadata = candidate.metadata && typeof candidate.metadata === 'object'
      ? candidate.metadata
      : (typeof candidate.metadata === 'string'
        ? (() => { try { return JSON.parse(candidate.metadata) || {}; } catch { return {}; } })()
        : {});
    const assetId = candidate.asset_id ?? candidate.assetId ?? candidateMetadata.asset_id ?? candidateMetadata.assetId ?? candidate.id;
    addId(assetId, primaryAssetIds);
    if (isVideo) addId(assetId, primaryVideoAssetIds);
    const urls = [
      candidate.url, candidate.file_url, candidate.fileUrl,
      candidate.original_url, candidate.originalUrl,
      candidate.thumbnail_url, candidate.thumbnailUrl,
      candidate.poster_url, candidate.posterUrl,
    ];
    urls.forEach((value) => {
      const normalized = normalizeImageUrl(value);
      if (!normalized) return;
      addMediaPathKey(normalized);
      if (isVideo) {
        primaryVideoUrls.add(normalized);
        if (candidate.ratio) videoUrlRatio[normalized] = candidate.ratio;
      } else {
        primaryImageUrls.add(normalized);
        if (candidate.ratio) imageUrlRatio[normalized] = candidate.ratio;
      }
    });
  });
  return rawList.map((item) => {
    if (item.category !== 'storyboard' && item.category !== 'reference') return item;
    let is_primary = item.is_primary
      ?? item.isPrimary
      ?? item.is_finalized
      ?? item.isFinalized
      ?? item.finalized
      ?? false;
    let ratio = item.ratio || '';
    const itemId = String(item.id ?? item.asset_id ?? item.assetId ?? '');
    const itemUrls = [
      item.file_url, item.original_url, item.originalUrl, item.url,
      item.thumbnail_url, item.thumbnailUrl, item.preview_url, item.previewUrl,
    ].map(normalizeImageUrl).filter(Boolean);
    const matchedById = primaryAssetIds.has(itemId) || primaryVideoAssetIds.has(itemId);
    const matchedByUrl = itemUrls.some((url) => primaryImageUrls.has(url) || primaryVideoUrls.has(url) || primaryMediaPathKeys.has(getMediaPathKey(url)));
    if (item.asset_type === 'video') {
      // 保留后端原始 is_primary，或通过 storyboard 交叉比对补充
      is_primary = is_primary || matchedById || matchedByUrl;
      if (!ratio) ratio = videoAssetIdRatio[itemId] || itemUrls.map((url) => videoUrlRatio[url]).find(Boolean) || '';
    } else {
      // 保留后端原始 is_primary，或通过 storyboard 交叉比对补充
      is_primary = is_primary || matchedById || matchedByUrl;
      if (!ratio) ratio = itemUrls.map((url) => imageUrlRatio[url] || videoUrlRatio[url]).find(Boolean) || '';
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
    const needsStoryboards = category === 'storyboard' || !category;
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
  const needsStoryboards = category === 'storyboard' || !category;
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
  const images = Array.isArray(rawOutputs) && rawOutputs.length > 0
    ? rawOutputs.map((out, idx) => ({
      id: out.id || out.asset_id || `img_${idx}`,
      src: normalizeImageUrl(out.url || out.file_url || out.image_url || ''),
      finalized: !!(out.is_finalized != null ? out.is_finalized : (out.finalized ?? false)),
      prompt: out.prompt || '',
      model: out.model || '',
      resolution: out.resolution || out.size || '',
      generatedAt: out.created_at || '',
    }))
    : [{
    // 无量产结果时用主文件作为唯一图片
      id: `${data?.id || shotId}_0`,
      src: normalizeImageUrl(data?.file_url || data?.thumbnail_url || ''),
      finalized: true,
      prompt: data?.prompt || '',
      model: data?.model || '',
      resolution: data?.size || '',
      generatedAt: data?.created_at || '',
    }];

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
