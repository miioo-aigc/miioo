import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { normalizeImageUrl } from '../../utils/imageUrl';
import Checkbox from '../Checkbox';
import NarrationAddButton from './NarrationAddButton';

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
    <button type="button" onClick={() => onSelect?.(item)} onMouseEnter={(event) => onPreview?.(item, event.currentTarget)} onMouseLeave={() => onPreview?.(null)} style={{
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

export default function StoryboardShotMediaColumn({ candidates = [], image, video, generating, onOpenCreation, onUpload, onFinalizeToggle, onSelectShot, shotLabel }) {
  const inputRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const media = candidates.length > 0 ? candidates : [image, video].filter(Boolean).map((item) => ({ ...item, media_type: item.type?.startsWith('video') ? 'video' : 'image', is_finalized: true }));

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

  function handlePreview(item, cardElement) {
    if (!item || !cardElement) {
      setPreview(null);
      return;
    }

    const rect = cardElement.getBoundingClientRect();
    const viewportPadding = 12;
    const gap = 8;
    const width = Math.min(320, Math.max(1, window.innerWidth - viewportPadding * 2));
    const height = Math.min(220, Math.max(1, window.innerHeight - viewportPadding * 2));
    const rightPosition = rect.right + gap;
    const leftPosition = rect.left - width - gap;
    const left = rightPosition + width <= window.innerWidth - viewportPadding
      ? rightPosition
      : leftPosition >= viewportPadding
        ? leftPosition
        : Math.max(viewportPadding, Math.min(rect.left, window.innerWidth - width - viewportPadding));
    const top = rect.top + height <= window.innerHeight - viewportPadding
      ? rect.top
      : Math.max(viewportPadding, Math.min(rect.bottom - height, window.innerHeight - height - viewportPadding));

    setPreview({ item, left, top, width, height });
  }

  return (
    <div style={{ width: 'fit-content', minWidth: 'fit-content', boxSizing: 'border-box', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', borderRight: '1px solid rgba(255,255,255,0.08)', alignSelf: 'stretch', position: 'relative' }}>
      <input ref={inputRef} type="file" accept="image/*,video/*" hidden onChange={handleFile} />
      <div style={{ width: '60px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <span style={{ font: `12px ${FONT}`, color: '#FFFFFF99', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>分镜</span>
        {media.length > 0 && <NarrationAddButton tooltip="创作" onClick={handleOpenCreation} />}
      </div>
      {generating && <div style={{ height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2DC3E1', font: `12px ${FONT}` }}>生成中</div>}
      {!generating && media.length === 0 && <PlusButton tooltip="创作" onClick={handleOpenCreation} />}
      {!generating && media.length > 0 && <div style={{ minHeight: 0, flex: 1, display: 'flex', gap: '4px', flexFlow: 'column nowrap', overflowY: 'auto', overflowX: 'hidden', width: 'fit-content' }}>
        {media.map((item, index) => (
          <CandidateCard key={item.id || item.url || index} item={item} finalized={item.is_finalized} onSelect={() => { onSelectShot?.(); onFinalizeToggle?.(item); }} onPreview={handlePreview} />
        ))}
      </div>}
      {preview?.item && createPortal(
        <div style={{ position: 'fixed', zIndex: 10010, left: preview.left, top: preview.top, width: preview.width, height: preview.height, boxSizing: 'border-box', padding: '6px', borderRadius: '8px', background: '#090909', border: '1px solid rgba(255,255,255,0.16)', pointerEvents: 'none', overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.70)' }}>
          <span style={{ position: 'absolute', top: 0, right: 0, zIndex: 1, padding: '0 8px', background: '#000000CC', color: '#FFFFFFCC', font: `12px/22px ${FONT}` }}>
            {preview.item.media_type === 'video' || preview.item.type?.startsWith('video') ? '视频' : '图片'}
          </span>
          {preview.item.media_type === 'video' ? <video autoPlay muted loop playsInline src={normalizeImageUrl(preview.item.preview_video_url || preview.item.url)} style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <img src={normalizeImageUrl(preview.item.large_url || preview.item.preview_url || preview.item.url)} alt={shotLabel || ''} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />}
        </div>,
        document.body,
      )}
    </div>
  );
}
