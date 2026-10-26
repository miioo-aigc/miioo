import { getCanvasImagePreview, getCanvasVideoPoster } from './CanvasMediaSources.js';

const AREA = 240 * 240;
const MAX_EDGE = 480;

export function getCanvasMediaSize(asset) {
  if (!asset || !['image', 'video'].includes(asset.asset_type)) return null;
  const width = Number(asset.width || asset.metadata?.width);
  const height = Number(asset.height || asset.metadata?.height);
  if (!(width > 0 && height > 0 && Number.isFinite(width) && Number.isFinite(height))) return null;
  const ratio = width / height;
  const w = Math.sqrt(AREA * ratio);
  const h = Math.sqrt(AREA / ratio);
  const scale = Math.min(1, MAX_EDGE / Math.max(w, h));
  // 图片和视频内容保持精确比例，外框另外容纳两侧各 1px 边框，避免 contain 留缝。
  return { width: w * scale + 2, height: h * scale + 2 };
}

export function getCanvasAssetNodeSize(asset) {
  const size = getCanvasMediaSize(asset) || { width: 240, height: 240 };
  return { width: size.width, height: size.height + 24 };
}

// Import layout and rendered nodes share the same metadata probe; failed media keeps its default card.
export function prepareCanvasMediaAsset(asset) {
  if (getCanvasMediaSize(asset) || !['image', 'video'].includes(asset?.asset_type) || !asset.url) return Promise.resolve(asset);
  return new Promise((resolve) => {
    const poster = asset.asset_type === 'video' ? getCanvasVideoPoster(asset) : undefined;
    const video = asset.asset_type === 'video' && !poster;
    const media = video ? document.createElement('video') : new Image();
    let timer;
    const finish = () => {
      clearTimeout(timer);
      const width = video ? media.videoWidth : media.naturalWidth;
      const height = video ? media.videoHeight : media.naturalHeight;
      media.onload = media.onloadedmetadata = media.onerror = null;
      if (video) { media.removeAttribute('src'); media.load(); }
      resolve(width && height ? { ...asset, width, height } : asset);
    };
    media.onerror = finish;
    if (video) { media.preload = 'metadata'; media.onloadedmetadata = finish; }
    else media.onload = finish;
    timer = setTimeout(finish, 8000);
    media.src = poster || (video ? asset.url : getCanvasImagePreview(asset));
  });
}
