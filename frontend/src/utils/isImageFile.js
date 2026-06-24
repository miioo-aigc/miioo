const IMAGE_EXTS_SET = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.tiff', '.tif', '.heic', '.heif']);

export default function isImageFile(file) {
  if (!file) return false;
  if (file.type && file.type.startsWith('image/')) return true;
  if (file.isAsset && file.url) {
    if (/\.(jpg|jpeg|png|webp|gif|bmp|tiff?|heic|heif)$/i.test(file.url)) return true;
  }
  const ext = '.' + (file.name || '').split('.').pop().toLowerCase();
  return IMAGE_EXTS_SET.has(ext);
}
