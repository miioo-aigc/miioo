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
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) };
}

export function getCanvasAssetNodeSize(asset) {
  const size = getCanvasMediaSize(asset) || { width: 240, height: 240 };
  return { width: size.width, height: size.height + 24 };
}

// Import layout and rendered nodes share the same metadata probe; failed media keeps its default card.
export function prepareCanvasMediaAsset(asset) {
  if (getCanvasMediaSize(asset) || !['image', 'video'].includes(asset?.asset_type) || !asset.url) return Promise.resolve(asset);
  return new Promise((resolve) => {
    const video = asset.asset_type === 'video';
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
    media.src = asset.url;
  });
}
