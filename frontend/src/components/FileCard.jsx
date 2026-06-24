import { useState, useEffect, useRef, memo } from 'react';
import { createPortal } from 'react-dom';
import { FONT } from '../utils/fonts';
import isImageFile from '../utils/isImageFile';
import isVideoFile from '../utils/isVideoFile';
import FilePreviewTooltip from './FilePreviewTooltip';

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function truncateFileName(name) {
  const dotIndex = name.lastIndexOf('.');
  if (dotIndex === -1) return name;
  const base = name.slice(0, dotIndex);
  const ext = name.slice(dotIndex);
  const maxBase = 12;
  if (base.length <= maxBase) return name;
  return base.slice(0, maxBase) + '… ' + ext;
}

function FileCard({ file, onRemove, disabled = false, onInsert }) {
  const [hovered, setHovered] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [videoSrc, setVideoSrc] = useState(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [cardRect, setCardRect] = useState(null);
  const hoverTimerRef = useRef(null);
  const cardRef = useRef(null);
  const isImage = isImageFile(file);
  const isVideo = isVideoFile(file);

  useEffect(() => {
    if (isImage) {
      if (file.isAsset && file.url) {
        setPreviewUrl(file.url);
        return;
      }
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }

    if (isVideo) {
      let objectUrl = null;
      let videoUrl;
      if (file.isAsset && file.url) {
        videoUrl = file.url;
        setVideoSrc(file.url);
      } else if (file._objectUrl) {
        videoUrl = file._objectUrl;
        setVideoSrc(file._objectUrl);
      } else {
        objectUrl = URL.createObjectURL(file);
        videoUrl = objectUrl;
        setVideoSrc(objectUrl);
      }
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      const handleLoadedData = () => { video.currentTime = 0.1; };
      const handleSeeked = () => {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        setPreviewUrl(canvas.toDataURL('image/jpeg', 0.8));
      };
      video.addEventListener('loadeddata', handleLoadedData);
      video.addEventListener('seeked', handleSeeked);
      video.src = videoUrl;
      return () => {
        video.removeEventListener('loadeddata', handleLoadedData);
        video.removeEventListener('seeked', handleSeeked);
        if (objectUrl) URL.revokeObjectURL(objectUrl);
      };
    }
  }, [file, isImage, isVideo]);

  if (isImage || isVideo) {
    return (
      <>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            gap: '2px',
            borderRadius: '8px',
            width: '100px',
            height: '100px',
            justifyContent: 'space-between',
            flexShrink: 0,
            position: 'relative',
            background: '#1D1E1E',
            border: '1px solid #FFFFFF14',
            overflow: 'hidden',
            opacity: disabled ? 0.45 : 1,
            cursor: disabled ? 'default' : 'pointer',
          }}
          ref={cardRef}
          onMouseEnter={() => {
            if (!disabled) {
              setHovered(true);
              hoverTimerRef.current = setTimeout(() => {
                if (cardRef.current) setCardRect(cardRef.current.getBoundingClientRect());
                setPreviewVisible(true);
              }, 500);
            }
          }}
          onMouseLeave={() => {
            setHovered(false);
            clearTimeout(hoverTimerRef.current);
            setPreviewVisible(false);
          }}
          onClick={() => {
            if (!disabled) {
              if (onInsert) { onInsert(); }
            }
          }}
        >
          {isVideo && hovered && videoSrc ? (
            <video
              src={videoSrc}
              autoPlay
              muted
              loop
              playsInline
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              onClick={(e) => { e.stopPropagation(); if (!disabled && onInsert) onInsert(); }}
            />
          ) : (
            <div
              style={{
                flex: 1,
                borderRadius: '7px',
                alignSelf: 'stretch',
                ...(previewUrl
                  ? { backgroundImage: `url(${previewUrl})`, backgroundSize: 'cover', backgroundPosition: '50%' }
                  : { background: '#FFFFFF14' }),
              }}
            />
          )}
          {hovered && !disabled && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onRemove(); }}
              style={{ position: 'absolute', display: 'flex', alignItems: 'center', justifyContent: 'center', top: '4px', right: '4px', width: '16px', height: '16px', borderRadius: '9999px', background: '#505151', border: 'none', cursor: 'pointer', padding: 0, zIndex: 1 }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M4.667 4.667L11.333 11.333" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M4.667 11.333L11.333 4.667" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
        </div>
        {previewVisible && (previewUrl || videoSrc) && createPortal(
          <FilePreviewTooltip
            isVideo={isVideo}
            previewUrl={previewUrl}
            videoSrc={videoSrc}
            cardRect={cardRect}
          />,
          document.body
        )}
      </>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: '2px',
        paddingLeft: '8px',
        paddingRight: '8px',
        paddingTop: '6px',
        paddingBottom: '6px',
        borderRadius: '8px',
        width: '100px',
        height: '100px',
        justifyContent: 'space-between',
        flexShrink: 0,
        position: 'relative',
        background: '#1D1E1E',
        border: `1px solid ${hovered ? '#FFFFFF33' : '#FFFFFF14'}`,
        transition: 'border-color 0.15s',
        opacity: disabled ? 0.45 : 1,
      }}
      onMouseEnter={() => !disabled && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{ fontFamily: FONT, fontSize: '14px', lineHeight: '150%', alignSelf: 'stretch', flex: 1, overflow: 'hidden', color: '#FFFFFF' }}>
        {truncateFileName(file.name)}
      </div>
      <div style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '150%', alignSelf: 'stretch', color: '#FFFFFF66' }}>
        {file.isAsset ? '资产库' : formatFileSize(file.size)}
      </div>
      {hovered && !disabled && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          style={{ position: 'absolute', display: 'flex', alignItems: 'center', justifyContent: 'center', top: '-5px', right: '-5px', width: '16px', height: '16px', borderRadius: '9999px', background: '#505151', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M4.667 4.667L11.333 11.333" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M4.667 11.333L11.333 4.667" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}
    </div>
  );
}

export default memo(FileCard);
