import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { normalizeImageUrl } from '../../utils/imageUrl';
import Checkbox from '../Checkbox';
import DotsLoading from '../DotsLoading';
import NarrationAddButton from './NarrationAddButton';
import { MediaHoverPreview } from './MainRefCol';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif";

function PlusButton({ onClick, small = false, tooltip = '创作' }) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      aria-label={tooltip}
      title={tooltip}
      style={{
        width: small ? '20px' : '44px',
        height: small ? '20px' : '44px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: small ? '4px' : '6px',
        border: small
          ? '1px solid rgba(255,255,255,0.10)'
          : `1px dashed ${hovered ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.12)'}`,
        background: pressed
          ? 'rgba(255,255,255,0.08)'
          : hovered
            ? small ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.06)'
            : small ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.03)',
        color: hovered ? 'rgba(255,255,255,0.70)' : small ? 'rgba(255,255,255,0.60)' : 'rgba(255,255,255,0.40)',
        cursor: 'pointer',
        flexShrink: 0,
        padding: 0,
        transition: 'background-color 0.12s, border-color 0.12s, color 0.12s',
      }}
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth={small ? '1.5' : '1.3'} strokeLinecap="round" /></svg>
    </button>
  );
}

function CandidateCard({ item, finalized, onSelect, onPreview }) {
  const isVideo = item.media_type === 'video' || item.type?.startsWith('video');
  const videoUrl = normalizeImageUrl(item.url || item.preview_video_url || item.previewVideoUrl || '');
  const providedPoster = normalizeImageUrl(
    item.poster_url
      || item.posterUrl
      || item.thumbnail_url
      || item.thumbnailUrl
      || item.video_thumbnail_url
      || item.videoThumbnailUrl
      || item.first_frame_url
      || item.firstFrameUrl
      || '',
  );
  const imageUrl = normalizeImageUrl(item.large_url || item.preview_url || item.url || '');
  const [capturedFrame, setCapturedFrame] = useState({ key: '', url: '' });

  useEffect(() => {
    if (!isVideo || providedPoster || !videoUrl) return undefined;

    let cancelled = false;
    const video = document.createElement('video');
    video.src = videoUrl;
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';

    const captureFirstFrame = () => {
      if (cancelled || !video.videoWidth || !video.videoHeight) return;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      if (!context) return;
      try {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        if (!cancelled) setCapturedFrame({ key: videoUrl, url: canvas.toDataURL('image/jpeg', 0.86) });
      } catch {
        // 跨域视频无法绘制 Canvas 时，下面的 video 标签继续作为兜底展示。
      }
    };
    const seekToStart = () => {
      try {
        video.currentTime = 0;
      } catch {
        captureFirstFrame();
      }
    };

    video.addEventListener('loadeddata', seekToStart, { once: true });
    video.addEventListener('seeked', captureFirstFrame, { once: true });
    video.load();

    return () => {
      cancelled = true;
      video.removeEventListener('loadeddata', seekToStart);
      video.removeEventListener('seeked', captureFirstFrame);
      video.removeAttribute('src');
      video.load();
    };
  }, [isVideo, providedPoster, videoUrl]);

  const coverUrl = providedPoster || (capturedFrame.key === videoUrl ? capturedFrame.url : '');
  return (
    <button type="button" onClick={() => onSelect?.(item)} onMouseEnter={(event) => onPreview?.(item, event)} onMouseLeave={() => onPreview?.(null)} style={{
      width: '60px', height: '60px', position: 'relative', padding: 0, overflow: 'hidden', flexShrink: 0, cursor: 'pointer',
      borderRadius: '4px', border: `1px solid ${finalized ? '#2DC3E1' : 'rgba(255,255,255,0.10)'}`, background: '#101111',
    }}>
      {isVideo ? (coverUrl
        ? <img src={coverUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : <video src={videoUrl} muted playsInline preload="metadata" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />)
        : <img src={imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
      <Checkbox
        checked={finalized}
        aria-label={finalized ? '已定稿' : '未定稿'}
        style={{ position: 'absolute', right: '4px', top: '4px', width: '14px', height: '14px', pointerEvents: 'none' }}
      />
    </button>
  );
}

function PendingCandidateCard() {
  return (
    <div
      aria-label="生成中"
      role="status"
      style={{
        width: '60px',
        height: '60px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        borderRadius: '4px',
        border: '1px solid rgba(45,195,225,0.45)',
        background: '#101111',
      }}
    >
      <DotsLoading size={4} color="#2DC3E1" gap={3} />
    </div>
  );
}

export default function StoryboardShotMediaColumn({ candidates = [], image, video, generating, loading = false, onOpenCreation, onUpload, onFinalizeToggle, onSelectShot }) {
  const inputRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const pendingMedia = candidates.filter((item) => item?.pending);
  const candidateMedia = candidates.filter((item) => !item?.pending);
  const media = candidateMedia.length > 0
    ? candidateMedia
    : [image, video].filter(Boolean).map((item) => ({ ...item, media_type: item.type?.startsWith('video') ? 'video' : 'image', is_finalized: true }));
  const hasPendingMedia = pendingMedia.length > 0 || (generating && media.length === 0);

  function handleFile(event) {
    const file = event.target.files?.[0];
    if (file) onUpload?.(file);
    event.target.value = '';
  }

  function handleOpenCreation(event) {
    // 行容器也监听 click 用于高亮镜头；新增按钮需要在同一次点击中完成选中和打开弹窗，
    // 不能让冒泡后的行回调把刚打开的弹窗立即关闭。
    event?.stopPropagation();
    onSelectShot?.();
    onOpenCreation?.();
  }

  function handlePreview(item, event) {
    if (!item || !event) {
      setPreview(null);
      return;
    }

    const isVideo = item.media_type === 'video' || item.type?.startsWith('video');
    const url = isVideo
      ? item.preview_video_url || item.previewVideoUrl || item.url || item.video_url || item.videoUrl
      : item.large_url || item.preview_url || item.previewUrl || item.url || item.thumbnail_url || item.thumbnailUrl;
    if (!url) {
      setPreview(null);
      return;
    }

    setPreview({ item, url: normalizeImageUrl(url), isVideo, mouseX: event.clientX, mouseY: event.clientY });
  }

  return (
    <div style={{ width: 'fit-content', minWidth: 'fit-content', boxSizing: 'border-box', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', borderRight: '1px solid rgba(255,255,255,0.08)', alignSelf: 'stretch', position: 'relative' }}>
      <input ref={inputRef} type="file" accept="image/*,video/*" hidden onChange={handleFile} />
      <div style={{ width: '60px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <span style={{ font: `12px ${FONT}`, color: '#FFFFFF99', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>分镜</span>
        {media.length > 0 && <NarrationAddButton tooltip="创作" onClick={handleOpenCreation} />}
      </div>
      {loading && media.length === 0 && !hasPendingMedia && (
        <div style={{ width: '60px', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px', background: '#101111' }} aria-label="正在加载分镜媒体" role="status">
          <DotsLoading size={4} color="#2DC3E1" gap={3} />
        </div>
      )}
      {!loading && media.length === 0 && !hasPendingMedia && <PlusButton tooltip="创作" onClick={handleOpenCreation} />}
      {(media.length > 0 || hasPendingMedia) && (
        <div style={{ minHeight: 0, flex: 1, position: 'relative', display: 'flex', gap: '4px', flexFlow: 'column nowrap', overflowY: 'auto', overflowX: 'hidden', width: 'fit-content' }}>
          {media.map((item, index) => (
            <CandidateCard key={item.id || item.url || index} item={item} finalized={item.is_finalized} onSelect={() => { onSelectShot?.(); onFinalizeToggle?.(item); }} onPreview={handlePreview} />
          ))}
          {pendingMedia.map((item) => <PendingCandidateCard key={item.id || item.taskId} />)}
          {hasPendingMedia && pendingMedia.length === 0 && <PendingCandidateCard />}
          {loading && media.length > 0 && pendingMedia.length === 0 && (
            <div style={{ position: 'absolute', inset: 0, minHeight: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px', background: 'rgba(16,17,17,0.58)', pointerEvents: 'none' }} aria-label="正在加载分镜媒体" role="status">
              <DotsLoading size={4} color="#2DC3E1" gap={3} />
            </div>
          )}
        </div>
      )}
      {preview?.item && createPortal(
        <MediaHoverPreview
          url={preview.url}
          isVideo={preview.isVideo}
          mouseX={preview.mouseX}
          mouseY={preview.mouseY}
        />,
        document.body,
      )}
    </div>
  );
}
