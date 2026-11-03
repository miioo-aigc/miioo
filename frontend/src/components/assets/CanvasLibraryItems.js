export const canvasLibraryItemKey = (item) => `${item.type}:${item.id}`;
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
  return [asset.original_url, asset.originalUrl, asset.audio_url, asset.audioUrl,
    asset.url, asset.file_url, asset.fileUrl, asset.source_url, asset.sourceUrl,
    asset.preview_url, asset.previewUrl]
    .find((value) => typeof value === 'string' && value.trim())?.trim() || '';
}
export const canvasLibraryMedia = (entry) => ({
  ...entry.asset, id: entry.id, asset_type: entry.asset?.media_type,
  file_url: entry.asset?.url || entry.asset?.file_url,
  preview_url: entry.asset?.preview_url || entry.asset?.url || entry.asset?.file_url,
  status: 'ready',
});
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
