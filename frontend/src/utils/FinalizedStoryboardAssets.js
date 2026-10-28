import { apiGetStoryboards, apiListStoryboardMediaCandidates } from '../api/storyboard';
import { normalizeImageUrl } from './imageUrl';
import { apiGetAssetDetail, apiGetAssetsPage } from '../api/assets';
import { compositionMediaSource } from './CompositionMediaSource';

function mediaKey(type, url) {
  if (!url) return null;
  const normalized = normalizeImageUrl(url);
  const path = normalized.replace(/^https?:\/\/[^/]+(?=\/uploads\/)/i, '');
  return `${type}:${path}`;
}

export async function resolveFinalizedStoryboardAssets(projectId, finalized) {
  const entries = finalized.map(({ media, shot }) => ({ media: { ...media }, shot }));
  const unresolved = entries.filter(({ media }) => !(media.assetId || media.asset_id || media.metadata?.asset_id || media.metadata?.assetId));
  for (const type of new Set(unresolved.map(({ media }) => media.mediaType ?? media.media_type))) {
    if (!['image', 'video', 'audio'].includes(type)) continue;
    const pending = unresolved.filter(({ media }) => (media.mediaType ?? media.media_type) === type);
    let cursor;
    let offset = 0;
    while (pending.some(({ media }) => !media.assetId)) {
      const page = await apiGetAssetsPage({ project_id: projectId, scope: 'project', category: 'storyboard', asset_type: type, include_deleted: false, limit: 200, ...(cursor ? { cursor } : { offset }) });
      for (const asset of page.list) {
        if (!asset.id || asset.asset_type !== type || !asset.file_url) continue;
        if (asset.project_id && String(asset.project_id) !== String(projectId)) continue;
        pending.forEach(({ media }) => {
          if (!media.assetId && media.url && mediaKey(type, media.url) === mediaKey(type, asset.file_url)) media.assetId = asset.id;
        });
      }
      if (!page.hasMore || !page.list.length) break;
      if (page.nextCursor && page.nextCursor === cursor) throw new Error('分镜资产分页异常，请重试');
      cursor = page.nextCursor;
      offset += page.list.length;
    }
  }
  // 旧候选可能没有原文件字段，按稳定资产 ID 补详情，不能直接把预览当成原片。
  const videoIds = [...new Set(entries.filter(({ media }) => (media.mediaType ?? media.media_type) === 'video'
    && !(media.downloadUrl || media.download_url))
    .map(({ media }) => media.assetId ?? media.asset_id ?? media.metadata?.asset_id ?? media.metadata?.assetId).filter(Boolean))];
  const details = new Map();
  for (let start = 0; start < videoIds.length; start += 6) {
    const batch = await Promise.allSettled(videoIds.slice(start, start + 6).map(async (id) => {
      const asset = await apiGetAssetDetail(id);
      if (String(asset?.id) !== String(id) || asset.asset_type !== 'video'
        || asset.is_deleted || asset.deleted_at || !asset.file_url) throw new Error('原视频不可用');
      return [String(id), asset];
    }));
    batch.forEach((result) => { if (result.status === 'fulfilled') details.set(...result.value); });
  }
  const assets = [];
  let unavailable = 0;
  entries.forEach((entry) => {
    const media = entry.media;
    const id = media.assetId ?? media.asset_id ?? media.metadata?.asset_id ?? media.metadata?.assetId;
    const needsDetail = (media.mediaType ?? media.media_type) === 'video' && !(media.downloadUrl || media.download_url);
    const detail = details.get(String(id));
    const asset = needsDetail && !detail ? null : finalizedMediaToAsset(detail
      ? { ...entry, media: { ...media, file_url: detail.file_url, downloadUrl: detail.download_url || detail.file_url } }
      : entry);
    if (asset) assets.push(asset);
    else unavailable += 1;
  });
  return { assets, unavailable };
}

export function finalizedMediaToAsset({ media, shot }) {
  const assetId = media.assetId ?? media.asset_id ?? media.metadata?.asset_id ?? media.metadata?.assetId;
  const source = compositionMediaSource(media);
  if (!assetId || !source) return null;
  return {
    id: assetId,
    asset_type: media.mediaType ?? media.media_type,
    name: media.name || `分镜${shot.shot_number ?? shot.sort_order ?? ''}定稿素材`,
    file_url: source,
    thumbnail_url: media.thumbnailUrl ?? media.thumbnail_url ?? (media.mediaType === 'image' ? media.url : null),
    poster_url: media.posterUrl ?? media.poster_url,
    download_url: media.downloadUrl ?? media.download_url,
    duration: media.duration ?? media.metadata?.duration,
    ratio: media.ratio,
    resolution: media.resolution,
    metadata_json: { ...media.metadata, storyboard_id: shot.id, shot_number: shot.shot_number, storyboard_media_url: media.url },
  };
}

export async function getMissingCompositionAssets(timeline, availableAssets, libraryAssetIds = []) {
  const availableIds = new Set(availableAssets.map((asset) => String(asset.id)));
  const missingIds = [...new Set([...libraryAssetIds, ...(timeline || []).map((item) => item.clip_id)].filter(Boolean))]
    .filter((id) => !availableIds.has(String(id)));
  const assets = [];
  for (let start = 0; start < missingIds.length; start += 6) {
    const batch = await Promise.allSettled(missingIds.slice(start, start + 6).map(async (id) => {
      const asset = await apiGetAssetDetail(id);
      if (!asset?.id || String(asset.id) !== String(id) || !asset.file_url) {
        throw new Error('草稿引用的素材无法加载，可能已被删除或无访问权限');
      }
      return { ...asset, manuallyAdded: true };
    }));
    assets.push(...batch.filter((item) => item.status === 'fulfilled').map((item) => item.value));
  }
  return assets;
}

export async function getFinalizedStoryboardMedia(projectId) {
  const storyboards = [];
  const pageSize = 200;
  for (let offset = 0; ; offset += pageSize) {
    const page = await apiGetStoryboards(projectId, { limit: pageSize, offset, include_gen_params: false });
    storyboards.push(...page);
    if (page.length < pageSize) break;
  }
  const finalized = [];
  for (let start = 0; start < storyboards.length; start += 6) {
    const batch = await Promise.all(storyboards.slice(start, start + 6).map(async (shot) => {
      const candidates = await apiListStoryboardMediaCandidates(projectId, shot.id);
      return candidates.filter((media) => media.isFinalized === true || media.is_finalized === true)
        .map((media) => ({ media, shot }));
    }));
    finalized.push(...batch.flat());
  }
  return finalized;
}

export function selectFinalizedStoryboardAssets(assets, finalized, episodeId) {
  const assetIds = new Set();
  const mediaUrls = new Set();
  finalized.forEach(({ media, shot }) => {
    if (episodeId && String(shot.episode_id ?? shot.episodeId) !== String(episodeId)) return;
    const assetId = media.assetId ?? media.asset_id ?? media.metadata?.asset_id ?? media.metadata?.assetId;
    if (assetId) assetIds.add(String(assetId));
    if (media.url) mediaUrls.add(mediaKey(media.mediaType ?? media.media_type, media.url));
  });
  return assets.filter((asset) => asset.manuallyAdded || assetIds.has(String(asset.id))
    || mediaUrls.has(mediaKey(asset.asset_type, asset.storyboardMediaUrl || asset.fileUrl)));
}
