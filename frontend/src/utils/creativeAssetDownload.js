/**
 * 创作资产下载适配。
 * 只负责从标准化创作资产中选择媒体地址和文件名，不执行浏览器副作用。
 */

import { filenameFromPrompt } from './creationFilename';

const DOWNLOAD_CONFIG = Object.freeze({
  image: { urlKeys: ['imageUrl', 'originalUrl'], ext: 'png', fallback: 'creation' },
  video: { urlKeys: ['videoUrl', 'originalUrl', 'posterUrl'], ext: 'mp4', fallback: 'creation' },
  audio: { urlKeys: ['audioUrl', 'originalUrl'], ext: 'mp3', fallback: 'creation' },
});

export function getCreativeAssetDownloadInfo(asset, { batch = false } = {}) {
  const config = DOWNLOAD_CONFIG[asset?.type];
  if (!config) return null;

  const url = config.urlKeys.map((key) => asset[key]).find(Boolean) || '';
  const ext = asset.type === 'audio' && batch ? 'wav' : config.ext;
  const fallback = asset.type === 'audio' && batch ? 'dubbing' : config.fallback;

  return {
    url,
    filename: filenameFromPrompt(asset.prompt, ext, fallback),
  };
}
