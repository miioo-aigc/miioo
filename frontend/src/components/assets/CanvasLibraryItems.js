export const canvasLibraryItemKey = (item) => `${item.type}:${item.id}`;
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
    if (Array.isArray(selection) && selection.length) onMove(selection, targetId);
  } catch { /* 忽略非本库拖放内容。 */ }
}
