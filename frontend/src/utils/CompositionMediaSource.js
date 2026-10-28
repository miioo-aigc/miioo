import { normalizeImageUrl } from './imageUrl';

// 剪辑必须优先读取原文件；候选 url / preview_video_url 可能是派生预览。
// download_url 由接口提供（可含受控访问签名），保留查询参数，不自行拼接鉴权。
export function compositionMediaSource(asset) {
  const type = asset.asset_type ?? asset.mediaType ?? asset.media_type ?? asset.type;
  const file = asset.file_url || asset.fileUrl || asset.url;
  return normalizeImageUrl(type === 'video'
    ? asset.download_url || asset.downloadUrl || file
    : file);
}
