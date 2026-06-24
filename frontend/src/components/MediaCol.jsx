import { useState, useRef } from 'react';
import MediaViewModal from './MediaViewModal';
import ShotViewerModal from './ShotViewerModal';
import DotsLoading from './DotsLoading';
import SbMediaIconBtn from './SbMediaIconBtn';
import { IconVideoPlaceholder, IconImagePlaceholder } from './StoryboardIcons';

export default function MediaCol({ media, onUpload, accept, isVideo, label, onAIGenerate, shotMeta, generating }) {
  const [hovered, setHovered] = useState(false);
  const [viewUrl, setViewUrl] = useState(null);
  const [viewerShot, setViewerShot] = useState(null);
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);

  function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (!isVideo && file.size > 20 * 1024 * 1024) { alert('抱歉，平台暂不支持上传20M以上的图片资源！'); e.target.value = ''; return; }
    const url = URL.createObjectURL(file);
    onUpload({ id: url, url, name: file.name, type: file.type, file });
    e.target.value = '';
  }

  function handleMouseEnter() {
    setHovered(true);
    if (isVideo && !isEmpty && !generating && videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
    }
  }

  function handleMouseLeave() {
    setHovered(false);
    if (isVideo && !isEmpty && !generating && videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  }

  const isEmpty = !media;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignSelf: 'stretch', flex: 1 }}>
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />

      <div
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={() => { if (!isEmpty || generating) onAIGenerate?.(); }}
        style={{
          flex: 1,
          minHeight: 0,
          alignSelf: 'stretch',
          borderRadius: '6px',
          position: 'relative',
          overflow: 'hidden',
          cursor: (isEmpty && !generating) ? 'default' : 'pointer',
          ...(isEmpty ? {
            backgroundColor: '#1D1E1E',
            border: '1px dashed rgba(255,255,255,0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          } : {
            border: `1px solid ${hovered ? 'rgba(45,195,225,0.50)' : 'rgba(255,255,255,0.06)'}`,
            transition: 'border-color 150ms',
          }),
        }}
      >
        {generating && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1D1E1E', borderRadius: '6px', zIndex: 2 }}>
            <DotsLoading size={4} color="#2DC3E1" gap={3} />
          </div>
        )}

        {!isEmpty && !generating && (
          isVideo ? (
            <video
              src={media.url}
              ref={videoRef}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
              muted
              playsInline
            />
          ) : (
            <img src={media.url} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
          )
        )}

        {!isEmpty && hovered && (
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            padding: '6px 6px',
            backgroundImage: 'linear-gradient(in oklab 0deg, oklab(0% 0 0 / 60%) 0%, oklab(0% 0 0 / 0%) 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px',
          }}>
            <SbMediaIconBtn onClick={(e) => { e.stopPropagation(); if (media?.url) {
              if (isVideo) {
                setViewerShot({ videoUrl: media.url, filename: media.name, label: shotMeta?.label, prompt: shotMeta?.prompt, model: shotMeta?.model, resolution: shotMeta?.resolution, duration: shotMeta?.duration, aspectRatio: shotMeta?.aspectRatio, finalized: shotMeta?.finalized });
              } else {
                setViewUrl(media.url);
              }
            }; }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M5.333 2H2.667C2.298 2 2 2.298 2 2.667V5.333" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M5.333 14H2.667C2.298 14 2 13.701 2 13.333V10.667" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M10.667 14H13.333C13.701 14 14 13.701 14 13.333V10.667" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M10.667 2H13.333C13.701 2 14 2.298 14 2.667V5.333" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </SbMediaIconBtn>
            <SbMediaIconBtn onClick={(e) => { e.stopPropagation(); if (media?.url) { const a = document.createElement('a'); a.href = media.url; a.download = media.name || 'download'; a.click(); } }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M8 2.667V10" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M5.333 7.333L8 10L10.667 7.333" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M2.667 12H13.333" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </SbMediaIconBtn>
          </div>
        )}

        {isEmpty && !hovered && !generating && (
          <div style={{
            width: '32px', height: '32px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: '8px',
            backgroundColor: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}>
            {isVideo ? <IconVideoPlaceholder /> : <IconImagePlaceholder />}
          </div>
        )}

        {isEmpty && hovered && !generating && (
          <div
            onMouseDown={(e) => { e.stopPropagation(); onAIGenerate?.(); }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '24px',
              paddingInline: '8px',
              borderRadius: '6px',
              backgroundColor: '#2DC3E1',
              border: '1px solid #FFFFFF33',
              outline: '1px solid rgba(0,0,0,0.50)',
              cursor: 'pointer',
              fontSize: '12px',
              color: '#090909',
              fontFamily: '"Alibaba PuHuiTi 2.0", system-ui, sans-serif',
              animation: 'slideUpBounce 300ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
              animationDelay: '0ms',
              opacity: 0,
              whiteSpace: 'nowrap',
            }}
          >
            {isVideo ? '创作视频' : '创作图片'}
          </div>
        )}
      </div>
      {viewUrl && <MediaViewModal url={viewUrl} onClose={() => setViewUrl(null)} />}
      {viewerShot && <ShotViewerModal shot={viewerShot} onClose={() => setViewerShot(null)} />}
    </div>
  );
}
