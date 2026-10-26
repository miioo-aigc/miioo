/** 卡片使用轻量图；原地址保留给详情、编辑、下载和生成引用。 */
const first = (...values) => values.find((value) => typeof value === 'string' && value.trim());

export function getCanvasImagePreview(asset) {
  return first(asset?.thumbnailUrl, asset?.thumbnail_url, asset?.previewUrl, asset?.preview_url,
    asset?.url, asset?.originalUrl, asset?.original_url);
}

export function getCanvasVideoPoster(asset) {
  return first(asset?.thumbnailUrl, asset?.thumbnail_url, asset?.posterUrl, asset?.poster_url);
}

export function getCanvasOriginalImage(asset) {
  return first(asset?.originalUrl, asset?.original_url, asset?.downloadUrl, asset?.download_url, asset?.url);
}
