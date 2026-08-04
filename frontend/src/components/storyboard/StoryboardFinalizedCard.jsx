import { useState } from 'react';
import { Button } from '../ui';
import DotsLoading from '../DotsLoading';
import { normalizeImageUrl } from '../../utils/imageUrl';
import { createPortal } from 'react-dom';
import { MediaHoverPreview } from './MainRefCol';
import StoryboardMediaPreview from './StoryboardMediaPreview';

// 时间轴卡片悬停时只加载 preview_video_url；封面字段仅用于静态图片预览。
export default function StoryboardFinalizedCard({ shot, media, loading = false, cardSize = { width: 240, height: 135 }, selected = false, onSelect, onCreate, onPreview, onDownload }) {
  const [hovered, setHovered] = useState(false);
  const [hoverPreview, setHoverPreview] = useState(null);
  const isVideo = media?.media_type === 'video' || media?.type?.startsWith('video');
  const mediaUrl = media?.url || media?.image_url || media?.imageUrl;
  const src = normalizeImageUrl(media?.media_preview_url
    || media?.mediaPreviewUrl
    || (isVideo ? media?.video_thumbnail_url || media?.videoThumbnailUrl || media?.poster_url || media?.posterUrl : media?.preview_url || media?.previewUrl || media?.thumbnail_url || media?.thumbnailUrl));
  const hasPreview = Boolean(src);
  const hasMedia = Boolean(mediaUrl || hasPreview);
  function enter(event) {
    setHovered(true);
    if (!media) return;
    const previewVideoUrl = isVideo
      ? media.preview_video_url
        || media.previewVideoUrl
        || media.metadata?.preview_video_url
        || media.metadata?.previewVideoUrl
        || media.gen_params?.preview_video_url
        || media.genParams?.previewVideoUrl
      : '';
    const previewUrl = isVideo
      ? media.video_thumbnail_url || media.videoThumbnailUrl || media.poster_url || media.posterUrl
      : media.media_preview_url || media.mediaPreviewUrl || media.preview_url || media.previewUrl || media.thumbnail_url || media.thumbnailUrl || media.url;
    const url = previewVideoUrl || previewUrl;
    if (url) setHoverPreview({ url: normalizeImageUrl(url), isVideo: Boolean(previewVideoUrl), x: event.clientX, y: event.clientY });
  }
  function move(event) {
    setHoverPreview((prev) => prev ? { ...prev, x: event.clientX, y: event.clientY } : prev);
  }
  function leave() { setHovered(false); setHoverPreview(null); }
  return (
    <>
    <div data-storyboard-finalized-card="true" onClick={onSelect} onMouseEnter={enter} onMouseMove={move} onMouseLeave={leave} style={{ width: `${cardSize.width}px`, height: `${cardSize.height}px`, position: 'relative', flexShrink: 0, overflow: 'hidden', borderRadius: '8px', border: `1px solid ${selected ? '#2DC3E1' : 'rgba(255,255,255,0.10)'}`, boxShadow: selected ? '0 0 0 1px rgba(45,195,225,0.30)' : 'none', background: hasMedia ? '#101111' : '#242424', cursor: 'pointer', transition: 'border-color 150ms, box-shadow 150ms' }}>
      {hasMedia && <StoryboardMediaPreview media={media} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />}
      <span style={{ position: 'absolute', top: '6px', left: '12px', padding: '0 8px', borderRadius: '3px', background: '#000000CC', color: '#FFFFFFCC', fontSize: '12px', lineHeight: '20px' }}>{String(shot.number).padStart(2, '0')}</span>
      {hasMedia && <span style={{ position: 'absolute', top: 0, right: 0, padding: '0 10px', background: '#00000080', color: '#FFFFFFCC', fontSize: '12px', lineHeight: '22px' }}>{isVideo ? '视频' : '图片'}</span>}
      {loading && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(16,17,17,0.58)', pointerEvents: 'none' }} aria-label="正在加载定稿媒体" role="status"><DotsLoading size={5} color="#2DC3E1" gap={3} /></div>}
      {!hasMedia && !loading && !hovered && <span style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', color: '#FFFFFF99', fontSize: '12px', lineHeight: '20px', whiteSpace: 'nowrap' }}>分镜{String(shot.number).padStart(2, '0')}</span>}
      <Button
        variant="accent"
        size="small"
        onClick={(event) => { event.stopPropagation(); onCreate?.(); }}
        tabIndex={hovered ? 0 : -1}
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          height: '24px',
          minHeight: '24px',
          boxSizing: 'border-box',
          opacity: hovered ? 1 : 0,
          transform: hovered ? 'translate(-50%, -50%)' : 'translate(-50%, calc(-50% + 12px))',
          pointerEvents: hovered ? 'auto' : 'none',
          transition: 'opacity 180ms ease-out, transform 180ms ease-out',
        }}
      >
        创作
      </Button>
      {hovered && hasMedia && <>
        <div style={{ position: 'absolute', right: '8px', bottom: '6px', display: 'flex', gap: '4px' }}>
          <button type="button" aria-label="放大" onClick={(event) => { event.stopPropagation(); onPreview?.(media, shot); }} style={{ width: '24px', height: '24px', border: 0, borderRadius: '4px', background: '#00000080', color: '#FFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
            <svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" style={{ overflow: 'visible', flexShrink: 0 }} aria-hidden="true">
              <path d="M5.333 2H2.667C2.298 2 2 2.298 2 2.667V5.333" fill="none" stroke="#FFFFFF" strokeLinejoin="round" />
              <path d="M5.333 14H2.667C2.298 14 2 13.701 2 13.333V10.667" fill="none" stroke="#FFFFFF" strokeLinejoin="round" />
              <path d="M10.667 14H13.333C13.701 14 14 13.701 14 13.333V10.667" fill="none" stroke="#FFFFFF" strokeLinejoin="round" />
              <path d="M10.667 2H13.333C13.701 2 14 2.298 14 2.667V5.333" fill="none" stroke="#FFFFFF" strokeLinejoin="round" />
            </svg>
          </button>
          <button type="button" aria-label="下载" onClick={(event) => { event.stopPropagation(); onDownload?.(media, shot); }} style={{ width: '24px', height: '24px', border: 0, borderRadius: '4px', background: '#00000080', color: '#FFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
            <svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" style={{ width: '16px', height: '16px', rotate: '180deg', overflow: 'visible', flexShrink: 0, transformOrigin: '50% 50%' }} aria-hidden="true">
              <path d="M8.003 4.7V14" fill="none" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M4 8.667L8 4.667L12 8.667" fill="none" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M4 2H12" fill="none" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </>}
    </div>
    {hoverPreview && createPortal(
      <MediaHoverPreview url={hoverPreview.url} isVideo={hoverPreview.isVideo} mouseX={hoverPreview.x} mouseY={hoverPreview.y} />,
      document.body,
    )}
    </>
  );
}
