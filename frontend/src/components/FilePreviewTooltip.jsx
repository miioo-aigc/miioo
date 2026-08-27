import { createPortal } from 'react-dom';
import { normalizeImageUrl } from '../utils/imageUrl';

/**
 * 文件悬浮预览提示框
 * @param {boolean} isVideo - 是否为视频
 * @param {string} previewUrl - 图片/缩略图 URL
 * @param {string} videoSrc - 视频播放源 URL
 * @param {DOMRect|null} cardRect - 触发卡片的位置
 */
export default function FilePreviewTooltip({ isVideo, previewUrl, videoSrc, cardRect }) {
  if (!cardRect) return null;
  // 保持原有的相对尺寸，同时限制超宽屏下的最大预览范围。
  const maxW = Math.min(Math.round(window.innerWidth * 0.35), 480, window.innerWidth - 16);
  const maxH = Math.min(480, window.innerHeight - 16);
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
  // 与触发卡片顶部对齐，只有确实超出视口时才向上收回。
  const top = Math.max(8, Math.min(cardRect.top, window.innerHeight - maxH - 8));
  return createPortal(
    <div style={{
      position: 'fixed',
      zIndex: 9998,
      top,
      ...(left !== undefined ? { left } : { right }),
      maxWidth: maxW,
      maxHeight: maxH,
      borderRadius: '10px',
      overflow: 'hidden',
      boxShadow: '0 8px 32px #00000099',
      pointerEvents: 'none',
      background: '#1D1E1E',
    }}>
      {isVideo && videoSrc
        ? <video src={normalizeImageUrl(videoSrc)} autoPlay muted loop playsInline style={{ display: 'block', maxWidth: maxW, maxHeight: maxH, objectFit: 'contain' }} />
        : previewUrl && <img src={normalizeImageUrl(previewUrl)} alt="" style={{ display: 'block', maxWidth: maxW, maxHeight: maxH, objectFit: 'contain' }} />
      }
    </div>,
    document.body
  );
}
