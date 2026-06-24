const VIDEO_EXTS_SET = new Set(['.mp4', '.mov', '.avi', '.webm', '.mkv', '.wmv', '.flv']);

export default function isVideoFile(file) {
  if (!file) return false;
  if (file.type && file.type.startsWith('video/')) return true;
  if (file.isAsset && file.url) {
    if (/\.(mp4|mov|avi|webm|mkv|wmv|flv)$/i.test(file.url)) return true;
  }
  const ext = '.' + (file.name || '').split('.').pop().toLowerCase();
  return VIDEO_EXTS_SET.has(ext);
}
