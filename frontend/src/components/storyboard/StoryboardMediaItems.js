function assetId(item) {
  return String(item.asset_id || item.assetId || item.creationAssetId || item.backendId || '');
}

function originalUrls(item) {
  // 不使用缩略图、预览图或源资产编号，避免把不同编辑结果合并。
  return [item.originalUrl, item.original_url, item.remoteUrl, item.rawUrl,
    item.url, item.file_url, item.fileUrl, item.imageUrl].filter(Boolean);
}

function sameMedia(left, right) {
  const leftType = left.media_type || left.type || 'image';
  const rightType = right.media_type || right.type || 'image';
  if (leftType !== rightType) return false;
  if (left.id && right.id && String(left.id) === String(right.id)) return true;
  if (left.pending || right.pending) return false;
  const leftAsset = assetId(left);
  const rightAsset = assetId(right);
  if (leftAsset && rightAsset) return leftAsset === rightAsset;
  const urls = originalUrls(left);
  return originalUrls(right).some((url) => urls.includes(url));
}

export function mergeStoryboardMediaItems(candidates = [], edits = []) {
  const result = [];
  // 后端候选优先，保留它的候选编号、定稿状态和删除/下载语义。
  for (const item of [...candidates, ...edits]) {
    if (!item || (!item.id && !item.url)) continue;
    if (!result.some((existing) => sameMedia(existing, item))) result.push(item);
  }
  return result.sort((left, right) => {
    const finalizedOrder = Number(Boolean(right.is_finalized ?? right.isFinalized))
      - Number(Boolean(left.is_finalized ?? left.isFinalized));
    if (finalizedOrder) return finalizedOrder;
    const leftTime = Date.parse(left.created_at || left.createdAt || '');
    const rightTime = Date.parse(right.created_at || right.createdAt || '');
    // 无时间的旧记录排在有效时间之前；同一时间保持原来的相对顺序。
    const leftValid = Number.isFinite(leftTime);
    const rightValid = Number.isFinite(rightTime);
    if (leftValid !== rightValid) return leftValid ? 1 : -1;
    return leftValid ? leftTime - rightTime : 0;
  });
}
