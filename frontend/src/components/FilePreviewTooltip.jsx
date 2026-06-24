import { memo } from 'react';

function FilePreviewTooltip({ isVideo, previewUrl, videoSrc, cardRect }) {
  if (!cardRect) return null;
  const maxW = Math.round(window.innerWidth * 0.35);
  const gap = 12;
  const rightSpace = window.innerWidth - cardRect.right - gap;
  const leftSpace = cardRect.left - gap;
  let left, right;
  if (rightSpace >= maxW) {
    left = cardRect.right + gap;
  } else if (leftSpace >= maxW) {
    right = window.innerWidth - cardRect.left + gap;
    left = undefined;
  } else {
    left = Math.max(8, Math.min(window.innerWidth - maxW - 8, cardRect.right + gap));
  }
  let top = cardRect.top;
  const estH = maxW;
  if (top + estH > window.innerHeight - 8) top = Math.max(8, window.innerHeight - estH - 8);
  return (
    <div style={{
      position: 'fixed',
      zIndex: 9998,
      top,
      ...(left !== undefined ? { left } : { right }),
      maxWidth: maxW,
      borderRadius: '10px',
      overflow: 'hidden',
      boxShadow: '0 8px 32px #00000099',
      pointerEvents: 'none',
      background: '#1D1E1E',
    }}>
      {isVideo && videoSrc
        ? <video src={videoSrc} autoPlay muted loop playsInline style={{ display: 'block', maxWidth: maxW, maxHeight: maxW }} />
        : previewUrl && <img src={previewUrl} alt="" style={{ display: 'block', maxWidth: maxW, maxHeight: maxW, objectFit: 'contain' }} />
      }
    </div>
  );
}

export default memo(FilePreviewTooltip);
