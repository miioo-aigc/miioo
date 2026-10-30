import { normalizeImageUrl } from './imageUrl';

/** 卡片小图候选与原媒体分离；不把原图伪装成缩略图。 */
export function compositionAssetCoverUrls(asset) {
  const meta = asset.metadata_json || asset.metadata || {};
  const video = (asset.asset_type || asset.mediaType || asset.media_type || asset.type) === 'video';
  const candidates = [
    ...(Array.isArray(asset.coverUrls) ? asset.coverUrls : []),
    asset.thumbnailUrl, asset.thumbnail_url, meta.thumbnail_url, meta.thumbnailUrl,
    ...(video ? [asset.videoThumbnailUrl, asset.video_thumbnail_url, meta.video_thumbnail_url, meta.videoThumbnailUrl] : []),
    asset.posterUrl, asset.poster_url, meta.poster_url, meta.posterUrl,
    ...(!video ? [asset.previewUrl, asset.preview_url, meta.preview_url, meta.previewUrl] : []),
  ];
  const sources = new Set([asset.fileUrl, asset.file_url, asset.videoUrl, asset.video_url, asset.downloadUrl, asset.download_url].filter(Boolean).map(normalizeImageUrl));
  return [...new Set(candidates.filter(value => typeof value === 'string' && value.trim()).map(normalizeImageUrl))]
    .filter(url => !sources.has(url));
}
