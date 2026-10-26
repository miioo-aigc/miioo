import AsyncImagePreview from '../AsyncImagePreview';
import RecoverableVideoPreview from '../creation/RecoverableVideoPreview';
import { normalizeImageUrl } from '../../utils/imageUrl';

function isVideoMedia(media) {
  return media?.media_type === 'video' || media?.mediaType === 'video' || media?.type?.startsWith('video');
}

function getPreviewUrl(media) {
  const video = isVideoMedia(media);
  return normalizeImageUrl(
    media?.media_preview_url
      || media?.mediaPreviewUrl
      || (video
        ? media?.video_thumbnail_url || media?.videoThumbnailUrl || media?.poster_url || media?.posterUrl
        : media?.preview_url || media?.previewUrl || media?.thumbnail_url || media?.thumbnailUrl)
      || '',
  );
}

function getSourceUrl(media) {
  return normalizeImageUrl(media?.url || media?.image_url || media?.imageUrl || media?.preview_video_url || media?.previewVideoUrl || '');
}

/** 按源隔离预览；无封面视频直接使用原生首帧，不缓存跨资源截图。 */
export default function StoryboardMediaPreview({ media, alt = '', style, className, hovered = false }) {
  const video = isVideoMedia(media);
  const previewUrl = getPreviewUrl(media);
  const sourceUrl = getSourceUrl(media);
  const objectFit = style?.objectFit || 'cover';
  return <div className={className} style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', ...style }}>
    {video && !previewUrl
      ? <RecoverableVideoPreview key={sourceUrl} src={sourceUrl} hovered={hovered} objectFit={objectFit} />
      : <AsyncImagePreview visual plain src={previewUrl || sourceUrl} fallbackSrc={!video ? sourceUrl : undefined} alt={alt} imageStyle={{ objectFit }} />}
  </div>;
}
