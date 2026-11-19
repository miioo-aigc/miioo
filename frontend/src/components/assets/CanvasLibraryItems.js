export const canvasLibraryItemKey = (item) => `${item.type}:${item.id}`;
// 删除成功后按稳定键移除已提交条目，保留其余列表与当前滚动状态。
export function canvasLibraryRemoveItems(items = [], removed = []) {
  const removedKeys = new Set(removed.map(canvasLibraryItemKey));
  if (!removedKeys.size) return items;
  return items.filter((item) => !removedKeys.has(canvasLibraryItemKey(item)));
}
// 选择仅覆盖点击全选时已加载的条目，后续分页不会自动加入。
export const canvasLibrarySelectLoaded = (items, checked = true) => new Set(checked ? items.map(canvasLibraryItemKey) : []);
export function canvasLibraryToggleSelection(selected, key) {
  const next = new Set(selected);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return next;
}
// 兼容画布原件地址和创作音频地址；空白字段不阻断后续候选。
export function canvasLibraryAudioUrl(asset = {}) {
  if (['trashed', 'forbidden', 'missing'].includes(asset.availability)) return '';
  return [asset.original_url, asset.originalUrl, asset.audio_url, asset.audioUrl,
    asset.url, asset.file_url, asset.fileUrl, asset.source_url, asset.sourceUrl,
    asset.preview_url, asset.previewUrl]
    .find((value) => typeof value === 'string' && value.trim())?.trim() || '';
}
export const canvasLibraryUnavailable = (entry) => ['trashed', 'forbidden', 'missing'].includes(entry.asset?.availability);
export function canvasLibraryMedia(entry) {
  const asset = entry.asset || {};
  const type = String(asset.media_type || '').split('/')[0];
  const unavailable = canvasLibraryUnavailable(entry);
  return { ...asset, id: asset.id, entryId: entry.id, asset_type: type,
    url: unavailable ? undefined : type === 'image' ? asset.thumbnail_url || asset.preview_url || asset.url : asset.preview_url || asset.original_url || asset.url || asset.file_url,
    file_url: unavailable ? undefined : asset.preview_url || asset.original_url || asset.url || asset.file_url,
    preview_url: unavailable ? undefined : asset.preview_url || asset.original_url || asset.url || asset.file_url,
    status: unavailable ? asset.availability : 'ready',
    duration: asset.duration_ms == null ? undefined : asset.duration_ms / 1000,
  };
}
export const canvasLibraryDragType = 'application/x-miioo-canvas-library';
export function canvasLibraryDrop(event, onMove, targetId) {
  event.preventDefault();
  try {
    const selection = JSON.parse(event.dataTransfer.getData(canvasLibraryDragType));
    if (!Array.isArray(selection) || !selection.length) return;
    if (selection.some((item) => item.type === 'folder' && item.id === targetId)) return;
    if (selection.every((item) => item.source_folder_id === targetId)) return;
    onMove(selection, targetId);
  } catch { /* 忽略非本库拖放内容。 */ }
}

// 根目录只显示集合名；无编号的路径项不能用于跳转，重复目录只保留一次。
export function canvasLibraryPath(folder, parentId, rootFolderId) {
  if (!folder || !parentId || parentId === rootFolderId) return [];
  const seen = new Set([rootFolderId]);
  const ancestors = Array.isArray(folder.ancestors) ? folder.ancestors : [];
  return [...ancestors, folder].filter((item) => {
    if (!item?.id || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

// 删除命中当前路径时，从最浅层被删目录的父级返回；未被命中则保留当前目录并刷新。
export function canvasLibraryDeletionNavigation(folder, parentId, rootFolderId, selection = []) {
  const chain = [];
  const seen = new Set();
  for (const entry of [{ id: rootFolderId }, ...(folder?.ancestors || []), { id: parentId }, folder]) {
    if (!entry?.id || seen.has(entry.id)) continue;
    seen.add(entry.id);
    chain.push(entry);
  }
  const deletedFolderIds = new Set(selection.filter((item) => item.type === 'folder').map((item) => item.id));
  const firstDeletedIndex = chain.findIndex((entry) => deletedFolderIds.has(entry.id));
  if (firstDeletedIndex < 0) return { pathAffected: false, destinationId: null };
  return { pathAffected: true, destinationId: chain[firstDeletedIndex - 1]?.id || null };
}

// 只有集合删除才允许用 COLLECTION_NOT_FOUND 丢弃当前画布；普通条目失败时必须保留当前选择。
export function canvasLibraryDeletionInvalidatesCollection(error, selection = []) {
  return error?.code === 'COLLECTION_NOT_FOUND'
    && selection.some((item) => item.type === 'collection');
}
