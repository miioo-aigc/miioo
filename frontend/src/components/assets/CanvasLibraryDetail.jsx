/**
 * 画布资产详情：复用创作详情组件与云端图片编辑保存流程。
 * 只编排详情读取和收藏；下载、删除交回画布资产库。
 */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import AssetCardCreativeDetail from './AssetCardCreativeDetail';
import CreationAudioDetailModal from '../creation/CreationAudioDetailModal';
import useLocalImageEdits from '../../hooks/useLocalImageEdits';
import { canvasAssetLibrary } from '../../api/CanvasAssetLibrary';
import { normalizeAudioAssetDetail } from '../../utils/creationAudioDetailAdapter';
import { mergeCreationVideoDetail } from '../../utils/creationDetailAdapter';
import { showGlobalToast } from '../../stores/toastStore';
import { canvasLibraryAudioUrl } from './CanvasLibraryItems';

export default function CanvasLibraryDetail({ entry, onClose, onDownload, onDelete, onChanged }) {
  const [asset, setAsset] = useState(entry.asset || {});
  const saving = useRef(false);
  const active = useRef(true);
  const version = useRef(0);
  const assetId = entry.asset_id ?? entry.asset?.id;
  const edits = useLocalImageEdits(`creation:${assetId}`);
  useEffect(() => {
    active.current = true;
    let cancelled = false;
    const requestedVersion = version.current;
    canvasAssetLibrary.detail(entry).then((detail) => {
      if (!cancelled && requestedVersion === version.current) setAsset((current) => ({ ...current, ...detail }));
    }).catch((error) => { if (!cancelled) showGlobalToast(error.message, 'error'); });
    return () => { cancelled = true; active.current = false; };
  }, [entry]);

  async function favorite() {
    if (saving.current) return;
    saving.current = true;
    version.current += 1;
    const next = !(asset.is_starred ?? asset.is_favorite);
    try {
      await canvasAssetLibrary.favorite(entry, next);
      if (active.current) setAsset((current) => ({ ...current, is_starred: next }));
      onChanged();
    } catch (error) {
      showGlobalToast(error.message || '收藏失败，请重试', 'error');
    } finally { saving.current = false; }
  }

  let metadata = asset.metadata_json || asset.metadata || {};
  if (typeof metadata === 'string') { try { metadata = JSON.parse(metadata) || {}; } catch { metadata = {}; } }
  const type = String(asset.media_type || asset.asset_type || entry.asset?.media_type || '').split('/')[0];
  const originalUrl = asset.original_url || asset.originalUrl || asset.file_url || asset.fileUrl || asset.source_url || asset.url;
  const card = {
    ...metadata, ...asset, id: assetId, backendId: assetId, creationAssetId: assetId, type,
    imageUrl: asset.preview_url || asset.previewUrl || originalUrl, originalUrl,
    videoUrl: asset.video_url || asset.videoUrl || originalUrl || asset.preview_url,
    posterUrl: asset.poster_url || asset.posterUrl || asset.thumbnail_url,
    prompt: asset.input_prompt ?? asset.prompt ?? metadata.prompt,
    createdAt: asset.created_at || asset.createdAt,
    refImages: asset.refImages || metadata.refImages,
  };
  const shared = { onClose, onDownload, onDelete, onFavorite: favorite };
  const starred = Boolean(asset.is_starred ?? asset.is_favorite);
  return createPortal(type === 'audio' ? (
    <CreationAudioDetailModal {...normalizeAudioAssetDetail(asset)} {...shared} audioUrl={canvasLibraryAudioUrl(asset)} favorited={starred} />
  ) : (
    <AssetCardCreativeDetail {...shared} asset={type === 'video' ? mergeCreationVideoDetail(card, asset) : card}
      url={card.imageUrl} starred={starred} onCreateImage={edits.save} />
  ), document.body);
}
