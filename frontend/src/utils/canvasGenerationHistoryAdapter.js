const HISTORY_TYPES = new Set(['image', 'video', 'audio']);
const UNAVAILABLE_LABELS = {
  missing: '文件已缺失',
  forbidden: '无权访问',
  trashed: '素材已回收',
  unavailable: '素材暂不可用',
};
const SHANGHAI_TIME_ZONE = 'Asia/Shanghai';

function text(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function objectMetadata(value) {
  if (value && typeof value === 'object') return value;
  if (typeof value !== 'string' || !value.trim()) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function mediaType(item, asset) {
  const raw = text(item?.type) || text(asset?.media_type) || text(asset?.asset_type) || text(item?.media_type);
  const normalized = raw.toLowerCase().split('/')[0];
  return HISTORY_TYPES.has(normalized) ? normalized : '';
}

export function getCanvasGenerationAssetType(asset) {
  const raw = text(asset?.asset_type)
    || text(asset?.assetType)
    || text(asset?.type)
    || text(asset?.media_type);
  const normalized = raw.toLowerCase().split('/')[0];
  return HISTORY_TYPES.has(normalized) ? normalized : '';
}

export function isCanvasGenerationAssetReady(asset) {
  const availability = text(asset?.availability).toLowerCase();
  if (availability) return availability === 'ready';
  return asset?.ready === true;
}

export function getCanvasGenerationImportAsset(asset) {
  const type = getCanvasGenerationAssetType(asset);
  if (!isCanvasGenerationAssetReady(asset) || !type) return null;
  return { ...asset, asset_type: type, media_type: type };
}

export function filterCanvasGenerationSources(canvases = [], currentCanvasId, projectId) {
  const currentId = text(currentCanvasId);
  const currentProjectId = text(projectId);
  return canvases.filter((item) => {
    const itemId = String(item?.id || '');
    const status = text(item?.status).toLowerCase();
    const isCurrent = itemId === currentId;
    if (status !== 'active' && !(isCurrent && !status)) return false;
    return isCurrent
      || Boolean(currentProjectId && String(item?.project_id || '') === currentProjectId);
  });
}

function mediaUrl(asset, type, key) {
  const camel = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
  return text(asset?.[key]) || text(asset?.[camel]);
}

export function getCanvasGenerationAssetMediaUrl(asset) {
  return mediaUrl(asset, '', 'file_url')
    || mediaUrl(asset, '', 'original_url')
    || mediaUrl(asset, '', 'url');
}

function normalizedDate(value) {
  const raw = text(value);
  if (!raw) return null;
  const timestamp = new Date(raw).getTime();
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

/**
 * Normalize one history item without treating the history ID as an asset ID.
 * Temporary URLs are retained only while the asset is marked ready.
 */
export function normalizeCanvasGenerationRecord(item = {}) {
  const rawAsset = item.asset && typeof item.asset === 'object' ? item.asset : {};
  const metadata = objectMetadata(rawAsset.metadata_json ?? rawAsset.metadata);
  const type = mediaType(item, rawAsset);
  const assetId = text(item.asset_id) || text(rawAsset.id) || text(item.assetId);
  const historyId = text(item.id) || text(item.historyId);
  const availability = text(rawAsset.availability || item.availability).toLowerCase();
  // Preserve compatibility with the earlier asset payload, which used ready
  // instead of availability. Keep one readiness rule for display and import.
  const ready = isCanvasGenerationAssetReady({
    ready: rawAsset.ready ?? item.ready,
    availability: rawAsset.availability || item.availability,
  });
  const url = mediaUrl(rawAsset, type, 'original_url')
    || mediaUrl(rawAsset, type, 'file_url')
    || mediaUrl(rawAsset, type, 'url')
    || mediaUrl(rawAsset, type, `${type}_url`);
  const previewUrl = mediaUrl(rawAsset, type, 'preview_url')
    || (type === 'image' ? url : '');
  const posterUrl = mediaUrl(rawAsset, type, 'poster_url')
    || mediaUrl(rawAsset, type, 'thumbnail_url');
  const hasCompletedAt = Object.hasOwn(item, 'completed_at') || Object.hasOwn(item, 'completedAt');
  const completedAt = hasCompletedAt
    ? item.completed_at ?? item.completedAt
    : item.created_at ?? item.createdAt;
  const asset = {
    ...metadata,
    ...rawAsset,
    id: assetId || undefined,
    asset_id: assetId || undefined,
    asset_type: type || undefined,
    media_type: type || undefined,
    name: ready ? text(rawAsset.name) || text(metadata.name) || undefined : undefined,
    availability: availability || undefined,
    preview_url: ready ? previewUrl || undefined : undefined,
    previewUrl: ready ? previewUrl || undefined : undefined,
    original_url: ready ? url || undefined : undefined,
    originalUrl: ready ? url || undefined : undefined,
    file_url: ready ? url || undefined : undefined,
    fileUrl: ready ? url || undefined : undefined,
    url: ready ? url || undefined : undefined,
    thumbnail_url: ready ? mediaUrl(rawAsset, type, 'thumbnail_url') || undefined : undefined,
    thumbnailUrl: ready ? mediaUrl(rawAsset, type, 'thumbnailUrl') || undefined : undefined,
    poster_url: ready ? posterUrl || undefined : undefined,
    posterUrl: ready ? posterUrl || undefined : undefined,
    download_url: ready ? mediaUrl(rawAsset, type, 'download_url') || undefined : undefined,
    downloadUrl: ready ? mediaUrl(rawAsset, type, 'downloadUrl') || undefined : undefined,
    prompt: text(item.input_prompt)
      || text(item.prompt)
      || text(rawAsset.input_prompt)
      || text(rawAsset.prompt)
      || text(metadata.prompt)
      || undefined,
  };
  return {
    historyId,
    canvasId: text(item.canvas_id),
    type,
    assetId,
    ready,
    availability,
    availabilityLabel: ready ? '' : UNAVAILABLE_LABELS[availability] || '素材不可用',
    createdAt: normalizedDate(item.created_at ?? item.createdAt),
    completedAt: normalizedDate(completedAt),
    asset,
    raw: item,
  };
}

export function mergeCanvasGenerationRecord(record, detail) {
  if (!record || !detail || typeof detail !== 'object') return record;
  const merged = normalizeCanvasGenerationRecord({
    ...record.raw,
    asset_id: record.assetId,
    type: record.type,
    asset: {
      ...record.asset,
      ...detail,
      availability: detail.availability ?? record.asset.availability,
      media_type: detail.media_type ?? detail.asset_type ?? record.type,
      id: detail.id ?? detail.asset_id ?? record.assetId,
    },
  });
  return merged.type ? merged : record;
}

/**
 * Asset detail is a separate authority boundary. Do not let a mismatched or
 * stale response make a history item actionable again.
 */
export function mergeValidatedCanvasGenerationDetail(record, detail) {
  if (!record?.assetId || !record?.type || !detail || typeof detail !== 'object') return null;

  const returnedId = text(detail.id) || text(detail.asset_id);
  const returnedAssetId = text(detail.asset_id);
  if (returnedId !== record.assetId || (returnedAssetId && returnedAssetId !== record.assetId)) return null;
  if (getCanvasGenerationAssetType(detail) !== record.type) return null;
  if (detail.is_deleted === true || text(detail.deleted_at)) return null;

  const hasAvailability = Object.hasOwn(detail, 'availability');
  const hasReadyFlag = Object.hasOwn(detail, 'ready');
  if (hasAvailability && !isCanvasGenerationAssetReady(detail)) return null;
  if (!hasAvailability && hasReadyFlag && detail.ready !== true) return null;
  if (!getCanvasGenerationAssetMediaUrl(detail)) return null;

  const merged = mergeCanvasGenerationRecord(record, detail);
  return isCanvasGenerationRecordReady(merged) ? merged : null;
}

function unavailableRecord(record, availability) {
  return normalizeCanvasGenerationRecord({
    ...record?.raw,
    asset_id: record?.assetId,
    type: record?.type,
    asset: {
      ...record?.asset,
      availability,
      preview_url: null,
      previewUrl: null,
      original_url: null,
      originalUrl: null,
      file_url: null,
      fileUrl: null,
      url: null,
      thumbnail_url: null,
      thumbnailUrl: null,
      poster_url: null,
      posterUrl: null,
      download_url: null,
      downloadUrl: null,
      name: '',
    },
  });
}

/**
 * Apply the complete resolve-assets partition. An omitted asset is treated as
 * unavailable so a stale temporary URL is never exposed indefinitely.
 */
export function mergeCanvasGenerationResolvedAssets(records = [], response = {}) {
  const missing = new Set((response?.missing_ids || []).map(text).filter(Boolean));
  const forbidden = new Set((response?.forbidden_ids || []).map(text).filter(Boolean));
  const resolvedItems = (response?.items || []).reduce((items, item) => {
    const id = text(item?.asset_id) || text(item?.id);
    if (id) items.set(id, item);
    return items;
  }, new Map());

  return sortCanvasGenerationRecords(records.map((record) => {
    if (!record?.assetId) return record;
    if (missing.has(record.assetId)) return unavailableRecord(record, 'missing');
    if (forbidden.has(record.assetId)) return unavailableRecord(record, 'forbidden');

    const item = resolvedItems.get(record.assetId);
    if (!item) return unavailableRecord(record, 'unavailable');
    if (getCanvasGenerationAssetType(item) !== record.type) {
      return unavailableRecord(record, 'unavailable');
    }

    return mergeCanvasGenerationRecord(record, {
      ...item,
      id: record.assetId,
      asset_id: record.assetId,
      name: text(item.title) || record.asset?.name,
    });
  }));
}

export function canvasGenerationRecordKey(record) {
  if (record?.historyId) return `history:${record.historyId}`;
  if (record?.assetId) return `asset:${record.assetId}`;
  return '';
}

export function isCanvasGenerationRecordReady(record) {
  return Boolean(record?.type && record.assetId && record.ready);
}

export function mergeCanvasGenerationRecords(...pages) {
  const records = new Map();
  for (const page of pages) {
    for (const raw of Array.isArray(page) ? page : []) {
      const record = normalizeCanvasGenerationRecord(raw);
      const key = canvasGenerationRecordKey(record);
      if (key) records.set(key, record);
    }
  }
  return sortCanvasGenerationRecords([...records.values()]);
}

export function sortCanvasGenerationRecords(records = []) {
  return [...records].sort((left, right) => {
    const leftTime = left?.completedAt ? new Date(left.completedAt).getTime() : -Infinity;
    const rightTime = right?.completedAt ? new Date(right.completedAt).getTime() : -Infinity;
    if (leftTime !== rightTime) return rightTime - leftTime;
    return String(right?.historyId || '').localeCompare(String(left?.historyId || ''));
  });
}

function shanghaiParts(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: SHANGHAI_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  return Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
}

function dateKey(value) {
  const parts = shanghaiParts(value);
  return parts ? `${parts.year}-${parts.month}-${parts.day}` : '';
}

export function shanghaiDayLabel(value, now = new Date()) {
  const key = dateKey(value);
  if (!key) return '未知时间';
  if (key === dateKey(now)) return '今天';
  if (key === dateKey(new Date(now.getTime() - 24 * 60 * 60 * 1000))) return '昨天';
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: SHANGHAI_TIME_ZONE,
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(value));
}

export function groupCanvasGenerationRecords(records = [], now = new Date()) {
  const groups = new Map();
  for (const record of sortCanvasGenerationRecords(records)) {
    const day = record.completedAt ? shanghaiDayLabel(record.completedAt, now) : '未知时间';
    if (!groups.has(day)) groups.set(day, []);
    groups.get(day).push(record);
  }
  return [...groups.entries()];
}

export function canvasGenerationFilename(record, filenameOverride) {
  const type = record?.type || 'file';
  const fallbackExtension = { image: 'png', video: 'mp4', audio: 'mp3' }[type] || 'bin';
  const fallbackName = `${({ image: '图片', video: '视频', audio: '音频' })[type] || '素材'}-${record?.assetId || record?.historyId || 'download'}`;
  const name = text(filenameOverride) || text(record?.asset?.name) || text(record?.asset?.file_name) || text(record?.asset?.filename) || fallbackName;
  return /\.[a-z0-9]{2,5}$/i.test(name) ? name : `${name}.${fallbackExtension}`;
}
