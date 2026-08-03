/**
 * 生成项目资产下载文件名。只处理命名，不执行下载副作用。
 */

const MIME_EXTENSION_MAP = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/ogg': 'ogg',
};

function sanitizePart(value, fallback) {
  const text = String(value ?? '').replace(/[\\/:*?"<>|\r\n\t]/g, '_').trim();
  return text || fallback;
}

export function getBlobExtension(blob) {
  const mimeType = String(blob?.type || '').split(';', 1)[0].toLowerCase();
  return MIME_EXTENSION_MAP[mimeType] || '';
}

export function getProjectAssetDownloadFilename({ projectName, categoryLabel, assetName, extension = '' }) {
  const baseName = [
    sanitizePart(projectName, '项目'),
    sanitizePart(categoryLabel, '资产'),
    sanitizePart(assetName, '未命名资产'),
  ].join('-');
  const normalizedExtension = String(extension || '').replace(/^\./, '').trim();
  return normalizedExtension ? `${baseName}.${normalizedExtension}` : baseName;
}
