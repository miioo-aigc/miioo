function assetId(image) {
  return String(image.asset_id || image.assetId || image.creationAssetId || image.backendId || '');
}

function originalUrls(image) {
  // url 在资产列表中可能是缩略图，不能用来判断原图是否相同。
  return [image.originalUrl, image.original_url, image.remoteUrl, image.fileUrl,
    image.file_url, image.image_url].filter(Boolean);
}

export function mergeProjectSubjectImages(images = [], edits = []) {
  const result = [];
  for (const image of [...images, ...edits]) {
    if (!image) continue;
    const duplicate = result.some((existing) => {
      if (existing.id && image.id && String(existing.id) === String(image.id)) return true;
      if (existing.pending || image.pending) return false;
      const leftId = assetId(existing);
      const rightId = assetId(image);
      if (leftId && rightId) return leftId === rightId;
      return originalUrls(existing).some((url) => originalUrls(image).includes(url));
    });
    // 后端记录优先，保留真实删除编号、定稿状态和下载信息。
    if (!duplicate) result.push(image);
  }
  return result;
}
