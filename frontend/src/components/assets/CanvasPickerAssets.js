import { canvasLibraryMedia, canvasLibraryAudioUrl } from './CanvasLibraryItems.js';

/** 回填使用真实素材编号，目录条目编号仅用于目录操作。 */
export function toCanvasPickerAsset(item) {
  const media = canvasLibraryMedia(item);
  const asset = item.asset || {};
  const id = item.asset_id || asset.id;
  const fileUrl = canvasLibraryAudioUrl(asset);
  const type = (asset.media_type || asset.asset_type || '').split('/')[0];
  return {
    ...media, id, asset_id: id, asset_type: type, type,
    name: asset.name || item.name || '未命名素材',
    url: fileUrl, fileUrl, fullUrl: fileUrl, file_url: fileUrl,
    source: 'canvas', entryId: item.id,
  };
}

/** 排序副本，避免修改资产库原列表。 */
export function sortCanvasPickerProjects(projects) {
  return [...projects]
    .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')) || String(b.id).localeCompare(String(a.id)))
    .map(project => ({
      ...project,
      canvases: [...project.canvases].sort((a, b) =>
        String(a.canvasCreatedAt || '').localeCompare(String(b.canvasCreatedAt || '')) || String(a.id).localeCompare(String(b.id))),
    }));
}
