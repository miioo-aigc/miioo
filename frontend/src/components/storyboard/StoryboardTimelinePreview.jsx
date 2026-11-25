import { useEffect, useRef, useState } from 'react';
import DotsLoading from '../DotsLoading';
import { normalizeImageUrl } from '../../utils/imageUrl';
import { storyboardMediaType } from '../../utils/storyboardMediaDedup';
import { createTimelineMediaLoad } from '../../utils/TimelineMediaLoad';

/** 时间轴专用预览：保留成功封面，持续自动恢复；不影响其他媒体卡片。 */
export default function StoryboardTimelinePreview({ media, hovered }) {
  const isVideo = storyboardMediaType(media) === 'video';
  const covers = [...new Set([
    media?.media_preview_url, media?.mediaPreviewUrl,
    ...(isVideo
      ? [media?.video_thumbnail_url, media?.videoThumbnailUrl, media?.poster_url, media?.posterUrl]
      : [media?.preview_url, media?.previewUrl, media?.thumbnail_url, media?.thumbnailUrl, media?.url, media?.image_url, media?.imageUrl]),
  ].filter(Boolean).map(normalizeImageUrl))];
  const videoSrc = isVideo ? normalizeImageUrl(media?.preview_video_url || media?.previewVideoUrl
    || media?.metadata?.preview_video_url || media?.metadata?.previewVideoUrl
    || media?.gen_params?.preview_video_url || media?.genParams?.previewVideoUrl || media?.url || '') : '';
  const sourceKey = JSON.stringify({ covers, videoSrc });
  return <TimelinePreviewSession key={sourceKey} sourceKey={sourceKey} hovered={hovered} />;
}

function TimelinePreviewSession({ sourceKey, hovered }) {
  const image = useRef(null);
  const video = useRef(null);
  const session = useRef(null);
  const [state, setState] = useState({ coverReady: false, frameReady: false, playing: false });
  useEffect(() => {
    const current = createTimelineMediaLoad({ image: image.current, video: video.current, ...JSON.parse(sourceKey), onChange: setState });
    session.current = current;
    current.start();
    return () => { current.dispose(); session.current = null; };
  }, [sourceKey]);
  useEffect(() => { session.current?.setHovered(hovered); }, [hovered, sourceKey]);
  const showVideo = state.frameReady && (!state.coverReady || (hovered && state.playing));
  const style = { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' };
  return <>
    <img ref={image} alt="" style={{ ...style, opacity: state.coverReady && !showVideo ? 1 : 0 }} />
    <video ref={video} muted loop playsInline preload="auto" style={{ ...style, opacity: showVideo ? 1 : 0 }} />
    {!state.coverReady && !state.frameReady && <div role="status" aria-label="媒体加载中" style={{ ...style, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <DotsLoading size={5} color="var(--color-brand-main)" gap={4} />
    </div>}
  </>;
}
