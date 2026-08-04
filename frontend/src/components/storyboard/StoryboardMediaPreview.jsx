import { useEffect, useState } from 'react';
import DotsLoading from '../DotsLoading';
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
  return normalizeImageUrl(media?.url || media?.image_url || media?.imageUrl || '');
}

export default function StoryboardMediaPreview({ media, alt = '', style, loading = 'lazy' }) {
  const video = isVideoMedia(media);
  const previewUrl = getPreviewUrl(media);
  const sourceUrl = getSourceUrl(media);
  const [capturedFrame, setCapturedFrame] = useState('');
  const [captureFailed, setCaptureFailed] = useState(false);

  useEffect(() => {
    if (!video || previewUrl || !sourceUrl) return undefined;
    let cancelled = false;
    const source = document.createElement('video');
    source.src = sourceUrl;
    source.muted = true;
    source.playsInline = true;
    source.preload = 'auto';

    const captureFirstFrame = () => {
      if (cancelled || !source.videoWidth || !source.videoHeight) return;
      const canvas = document.createElement('canvas');
      canvas.width = source.videoWidth;
      canvas.height = source.videoHeight;
      const context = canvas.getContext('2d');
      if (!context) return;
      try {
        context.drawImage(source, 0, 0, canvas.width, canvas.height);
        setCapturedFrame(canvas.toDataURL('image/jpeg', 0.86));
      } catch {
        // 跨域视频无法绘制时，下面的视频元素继续使用原视频作为兜底。
        setCaptureFailed(true);
      }
    };
    const seekToStart = () => {
      try { source.currentTime = 0; } catch { captureFirstFrame(); }
      if (source.readyState >= 2) captureFirstFrame();
    };
    source.addEventListener('loadeddata', seekToStart);
    source.addEventListener('seeked', captureFirstFrame);
    source.addEventListener('error', () => setCaptureFailed(true));
    source.load();
    return () => {
      cancelled = true;
      source.removeEventListener('loadeddata', seekToStart);
      source.removeEventListener('seeked', captureFirstFrame);
      source.removeAttribute('src');
      source.load();
    };
  }, [video, previewUrl, sourceUrl]);

  const resolvedPreview = previewUrl || capturedFrame;
  if (resolvedPreview) return <img src={resolvedPreview} alt={alt} loading={loading} style={style} />;
  if (video && sourceUrl && captureFailed) return <video src={sourceUrl} muted playsInline preload="metadata" poster={capturedFrame || undefined} style={style} />;
  if (video && sourceUrl) return <DotsLoading size={4} color="#2DC3E1" gap={3} />;
  if (!video && sourceUrl) return <img src={sourceUrl} alt={alt} loading={loading} style={style} />;
  return <DotsLoading size={4} color="#2DC3E1" gap={3} />;
}
