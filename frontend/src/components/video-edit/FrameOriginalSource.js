// 原画导出只使用原片字段；已知预览地址不能作为原片兜底。
export function resolveFrameOriginalUrl({ originalVideoUrl, videoUrl, sourceAsset = {} }) {
  sourceAsset ??= {};
  const previews = [sourceAsset.preview_video_url, sourceAsset.previewVideoUrl].filter(Boolean);
  const candidates = [sourceAsset.download_url, sourceAsset.downloadUrl, sourceAsset.original_url, sourceAsset.originalUrl, originalVideoUrl, sourceAsset.video_url, sourceAsset.videoUrl, videoUrl];
  return candidates.find(url => typeof url === 'string' && url.trim() && !previews.includes(url)) || '';
}
