import { useEffect, useMemo, useRef, useState } from 'react';
import FilePreviewTooltip from '../FilePreviewTooltip';
import { formatFileSize, isImageFile, isVideoFile, truncateFileName } from './CreationFileUtils';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif";

export default function CreationFileCard({ file, onRemove, disabled = false, onInsert }) {
  const [hovered, setHovered] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [cardRect, setCardRect] = useState(null);
  const hoverTimerRef = useRef(null);
  const cardRef = useRef(null);
  const isImage = isImageFile(file);
  const isVideo = isVideoFile(file);
  const generatedImageUrl = useMemo(() => {
    if (!isImage || file?.isAsset || file?.previewUrl || !(file instanceof File)) return null;
    return URL.createObjectURL(file);
  }, [file, isImage]);
  const generatedVideoUrl = useMemo(() => {
    if (!isVideo || file?.isAsset || file?._objectUrl || !(file instanceof File)) return null;
    return URL.createObjectURL(file);
  }, [file, isVideo]);
  const imagePreviewUrl = file?.isAsset ? file.url : file?.previewUrl || generatedImageUrl;
  const videoPreviewUrl = file?.isAsset ? file.url : file?._objectUrl || generatedVideoUrl;

  useEffect(() => () => {
    if (generatedImageUrl) URL.revokeObjectURL(generatedImageUrl);
    if (generatedVideoUrl) URL.revokeObjectURL(generatedVideoUrl);
  }, [generatedImageUrl, generatedVideoUrl]);

  useEffect(() => {
    if (isImage) {
      return undefined;
    }

    if (!isVideo) return undefined;
    const videoUrl = videoPreviewUrl;
    if (!videoUrl) return undefined;
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    if (videoUrl && !videoUrl.startsWith('blob:')) video.crossOrigin = 'anonymous';
    let cancelled = false;
    const timeoutId = setTimeout(() => { cancelled = true; }, 5000);
    const handleLoadedData = () => { if (!cancelled) video.currentTime = 0.1; };
    const handleSeeked = () => {
      if (cancelled) return;
      try {
        const maxW = 320;
        const scale = Math.min(1, maxW / video.videoWidth);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(video.videoWidth * scale);
        canvas.height = Math.round(video.videoHeight * scale);
        canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
        setPreviewUrl(canvas.toDataURL('image/jpeg', 0.7));
      } catch { /* cross-origin video w/o CORS — keep fallback icon */ }
      clearTimeout(timeoutId);
    };
    const handleError = () => { cancelled = true; };
    video.addEventListener('loadeddata', handleLoadedData);
    video.addEventListener('seeked', handleSeeked);
    video.addEventListener('error', handleError);
    video.src = videoUrl;
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      video.removeEventListener('loadeddata', handleLoadedData);
      video.removeEventListener('seeked', handleSeeked);
      video.removeEventListener('error', handleError);
    };
  }, [file, isImage, isVideo, videoPreviewUrl]);

  const displayPreviewUrl = imagePreviewUrl || previewUrl;

  const removeButton = (
    <button type="button" onClick={(event) => { event.stopPropagation(); onRemove(); }} style={{ position: 'absolute', display: 'flex', alignItems: 'center', justifyContent: 'center', top: '-5px', right: '-5px', width: '16px', height: '16px', borderRadius: '9999px', background: '#505151', border: 'none', cursor: 'pointer', padding: 0, zIndex: 1 }}>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4.667 4.667L11.333 11.333" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" /><path d="M4.667 11.333L11.333 4.667" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </button>
  );

  if (isImage || isVideo) {
    return <>
      <div ref={cardRef} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px', borderRadius: '8px', width: '100px', height: '100px', justifyContent: 'space-between', flexShrink: 0, position: 'relative', background: '#1D1E1E', border: '1px solid #FFFFFF14', overflow: 'hidden', opacity: disabled ? 0.45 : 1, cursor: disabled ? 'default' : 'pointer' }} onMouseEnter={() => { if (!disabled) { setHovered(true); hoverTimerRef.current = setTimeout(() => { if (cardRef.current) setCardRect(cardRef.current.getBoundingClientRect()); setPreviewVisible(true); }, 500); } }} onMouseLeave={() => { setHovered(false); clearTimeout(hoverTimerRef.current); setPreviewVisible(false); }} onClick={() => { if (!disabled) onInsert?.(); }}>
        <div style={{ flex: 1, borderRadius: '7px', alignSelf: 'stretch', ...(displayPreviewUrl ? { backgroundImage: `url(${displayPreviewUrl})`, backgroundSize: 'cover', backgroundPosition: '50%' } : { background: '#FFFFFF14' }), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {isVideo && !displayPreviewUrl && <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, opacity: 0.35 }}><path d="M5 4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H5Zm10.7 7.316a1 1 0 0 1 0 1.368l-4.7 4.8a1 1 0 0 1-1.7-.684V7.2a1 1 0 0 1 1.7-.684l4.7 4.8Z" fill="currentColor" /></svg>}
        </div>
        {hovered && !disabled && (
          <button type="button" onClick={(event) => { event.stopPropagation(); onRemove(); }} style={{ position: 'absolute', display: 'flex', alignItems: 'center', justifyContent: 'center', top: '4px', right: '4px', width: '16px', height: '16px', borderRadius: '9999px', background: '#505151', border: 'none', cursor: 'pointer', padding: 0, zIndex: 1 }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4.667 4.667L11.333 11.333" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" /><path d="M4.667 11.333L11.333 4.667" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        )}
      </div>
      {previewVisible && (displayPreviewUrl || videoPreviewUrl) && <FilePreviewTooltip isVideo={isVideo} previewUrl={displayPreviewUrl} videoSrc={videoPreviewUrl} cardRect={cardRect} />}
    </>;
  }

  return <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px', paddingLeft: '8px', paddingRight: '8px', paddingTop: '6px', paddingBottom: '6px', borderRadius: '8px', width: '100px', height: '100px', justifyContent: 'space-between', flexShrink: 0, position: 'relative', background: '#1D1E1E', border: `1px solid ${hovered ? '#FFFFFF33' : '#FFFFFF14'}`, transition: 'border-color 0.15s', opacity: disabled ? 0.45 : 1 }} onMouseEnter={() => !disabled && setHovered(true)} onMouseLeave={() => setHovered(false)}>
    <div style={{ fontFamily: FONT, fontSize: '14px', lineHeight: '150%', alignSelf: 'stretch', flex: 1, overflow: 'hidden', color: '#FFFFFF' }}>{truncateFileName(file.name)}</div>
    <div style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '150%', alignSelf: 'stretch', color: '#FFFFFF66' }}>{file.isAsset ? '资产库' : formatFileSize(file.size)}</div>
    {hovered && !disabled && removeButton}
  </div>;
}
