/**
 * @file RefImageField.jsx
 * @structure-index
 *
 * ─── 组件职责 ───────────────────────────────────────────────────────
 *   RefImageItem / RefImageUploadCard 已拆分至同目录独立组件
 *   RefImageField             参考图列表状态、上传、绑定和删除编排
 *
 * ─── 依赖边界 ───────────────────────────────────────────────────────
 *   仅依赖 AssetPickerModal、主体参考图 API 和图片地址工具
 *   不引用页面、Store、路由或生成表单状态
 *
 * ─── 更新记录 ───────────────────────────────────────────────────────
 *   2026-07-15  从 SubjectPage 抽离参考图编辑区及悬浮预览组合
 *   2026-07-15  使用 reducer 同步外部参考图，降低拆分后的状态链路风险
 *   2026-07-17  上传入口改为复用无业务 FileUploadButton，API 和绑定编排保持不变
 *   2026-07-17  拆分 RefImageItem 与 RefImageUploadCard，页面继续持有参考图业务编排
 *   2026-07-22  明确参考图仅写入主体 reference_images，不参与右侧候选图列表
 *   2026-07-30  上传/绑定成功后回读主体详情，关闭弹窗后恢复服务端参考图
 *   2026-08-03  参考图继续独立维护，不向候选图状态写入
 *   2026-08-03  参考图变更按完整资产列表串行持久化，修复删除后重开恢复旧图
 */
import { useEffect, useReducer, useRef, useState } from 'react';
import AssetPickerModal from '../AssetPickerModal';
import { apiBindSubjectReferenceImages, apiGetSubjectDetail, apiUploadSubjectReferenceImage } from '../../api/subject';
import { normalizeImageUrl } from '../../utils/imageUrl';
import { createLatestPersistenceQueue } from '../../utils/referenceMediaPersistence';
import { normalizeSubjectReferenceImages } from '../../utils/referenceMediaAdapter';
import RefImageItem from './RefImageItem';
import RefImageUploadCard from './RefImageUploadCard';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif";

function normalizeRefImages(refImageIds, previous = []) {
  if (!refImageIds || refImageIds.length === 0) return [];

  return refImageIds.map((item) => {
    if (item && typeof item === 'object' && item.id) {
      const existing = previous.find((image) => image?.id === item.id);
      return existing?.url ? existing : { id: item.id, url: item.url || null };
    }

    const id = item;
    const existing = previous.find((image) => image?.id === id);
    if (existing?.url) return existing;
    if (typeof id === 'string' && (id.startsWith('http') || id.startsWith('blob') || id.startsWith('/'))) {
      return { url: id, id };
    }
    return { id, url: null };
  });
}

function getReferenceImagesFromResponse(response) {
  const list = response?.reference_images
    || response?.referenceImages
    || response?.reference_image_ids
    || response?.referenceImageIds
    || response?.reference_image_urls
    || response?.referenceImageUrls
    || response?.subject?.reference_images
    || response?.subject?.referenceImages
    || response?.images
    || response?.data?.reference_images
    || response?.data?.referenceImages;
  return Array.isArray(list) ? list : [];
}

function normalizeServerReferenceImages(images, fallback = []) {
  const source = images.length > 0 ? images : fallback;
  return normalizeSubjectReferenceImages(source).map((image) => ({
    id: image.id,
    assetId: image.assetId || image.id,
    url: image.url,
  }));
}

function refImagesReducer(state, action) {
  switch (action.type) {
    case 'sync':
      return normalizeRefImages(action.refImageIds, state);
    case 'replace':
      return action.items;
    case 'replaceById':
      return state.map((image) => image.id === action.id ? { ...image, ...action.patch } : image);
    case 'removeById':
      return state.filter((image) => image.id !== action.id);
    case 'removeIndex':
      return state.filter((_, index) => index !== action.index);
    default:
      return state;
  }
}

export default function RefImageField({ maxImages = 3, projectId, subjectId, refImageIds = [], onRefImagesChange }) {
  const fileInputRef = useRef(null);
  const [refImages, dispatchRefImages] = useReducer(refImagesReducer, refImageIds, normalizeRefImages);
  const syncedRefImageKeyRef = useRef(JSON.stringify(refImageIds));
  const [assetPickerOpen, setAssetPickerOpen] = useState(false);
  const [loadingRefs, setLoadingRefs] = useState(false);
  const referenceMutationQueueRef = useRef(null);
  const uploadSequenceRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => () => { mountedRef.current = false; }, []);

  function getReferenceMutationQueue() {
    if (!referenceMutationQueueRef.current) {
      referenceMutationQueueRef.current = createLatestPersistenceQueue(async (mutation) => {
        let uploadFallback = [];
        if (mutation.kind === 'upload') {
          const response = await apiUploadSubjectReferenceImage(projectId, subjectId, mutation.file);
          const responseImages = getReferenceImagesFromResponse(response);
          const responseImage = response?.reference_image
            || response?.referenceImage
            || response?.image
            || response?.asset
            || response;
          uploadFallback = normalizeServerReferenceImages(
            responseImages,
            [responseImage].filter(Boolean),
          );
        } else {
          await apiBindSubjectReferenceImages(projectId, subjectId, {
            asset_ids: mutation.assetIds,
            primary_asset_id: mutation.assetIds[0] || null,
          });
        }
        const detail = await apiGetSubjectDetail(projectId, subjectId).catch(() => null);
        const detailImages = normalizeServerReferenceImages(getReferenceImagesFromResponse(detail));
        // 上传接口成功而详情接口尚未读到新绑定时，先保留上传响应，避免成功图片闪退；
        // 后续绑定/删除仍会通过队列继续以详情和完整 asset_ids 校正最终状态。
        const persistedImages = detailImages.length > 0 ? detailImages : uploadFallback;
        if (mountedRef.current) {
          dispatchRefImages({ type: 'replace', items: persistedImages });
          onRefImagesChange?.(persistedImages);
        }
      });
    }
    return referenceMutationQueueRef.current;
  }

  function getPersistedAssetIds(images) {
    return (Array.isArray(images) ? images : [])
      .map((image) => image?.assetId || image?.asset_id || image?.id)
      .filter((id) => id
        && !String(id).startsWith('upload-')
        && !String(id).startsWith('blob:')
        && !String(id).startsWith('/')
        && !String(id).startsWith('http'));
  }

  function persistReferenceImages(images, { showLoading = false } = {}) {
    const nextImages = Array.isArray(images) ? images : [];
    const assetIds = getPersistedAssetIds(nextImages);
    if (!projectId || !subjectId) return Promise.resolve(nextImages);

    if (showLoading) setLoadingRefs(true);
    const mutationPromise = getReferenceMutationQueue().enqueue({ kind: 'bind', assetIds })
      .finally(() => {
        if (showLoading && mountedRef.current) setLoadingRefs(false);
      });
    return mutationPromise;
  }

  useEffect(() => {
    const nextKey = JSON.stringify(refImageIds);
    if (syncedRefImageKeyRef.current === nextKey) return;
    syncedRefImageKeyRef.current = nextKey;
    dispatchRefImages({ type: 'sync', refImageIds });
  }, [refImageIds]);

  const canAddMore = refImages.length < maxImages;

  function handleFile(file) {
    if (file.size > 20 * 1024 * 1024) {
      alert('抱歉，平台暂不支持上传20M以上的图片资源！');
      return;
    }

    const blobUrl = URL.createObjectURL(file);
    uploadSequenceRef.current += 1;
    const tempId = `upload-${uploadSequenceRef.current}`;
    const newList = [...refImages, { url: blobUrl, id: tempId }].slice(0, maxImages);
    dispatchRefImages({ type: 'replace', items: newList });

    if (projectId && subjectId) {
      getReferenceMutationQueue().enqueue({ kind: 'upload', file })
        .catch((error) => {
          console.error('[RefImageField] 上传参考图失败:', error);
          dispatchRefImages({ type: 'removeById', id: tempId });
        });
    }
  }

  function handleAssetConfirm(selectedAssets) {
    const newList = [
      ...refImages,
      ...selectedAssets.map((asset) => ({
        url: normalizeImageUrl(asset.fileUrl || asset.originalUrl || asset.original_url || asset.thumbnailUrl || asset.thumbnail_url || asset.url || asset.file_url),
        id: asset.id,
        assetId: asset.id,
      })),
    ].slice(0, maxImages);
    dispatchRefImages({ type: 'replace', items: newList });
    onRefImagesChange?.(newList);
    setAssetPickerOpen(false);

    persistReferenceImages(newList, { showLoading: true })
      .catch((error) => console.error('[RefImageField] 绑定参考图失败:', error));
  }

  function handleRemove(index) {
    const newList = refImages.filter((_, itemIndex) => itemIndex !== index);
    dispatchRefImages({ type: 'replace', items: newList });
    onRefImagesChange?.(newList);
    // 空列表也必须提交，才能真正清空后端绑定关系；不能把空列表当作“不请求”。
    persistReferenceImages(newList)
      .catch((error) => console.error('[RefImageField] 删除参考图绑定失败:', error));
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <AssetPickerModal
        accept="image"
        open={assetPickerOpen}
        onClose={() => setAssetPickerOpen(false)}
        onConfirm={handleAssetConfirm}
        projectId={projectId}
        preSelectedIds={refImages.map((image) => image.assetId).filter(Boolean)}
        preSelectedUrls={refImages.map((image) => image.url).filter(Boolean)}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(event) => { if (event.target.files?.[0]) handleFile(event.target.files[0]); event.target.value = ''; }}
      />
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
        <span style={{ flex: '0 1 auto', fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: 'rgba(255,255,255,0.6)', width: 'auto' }}>参考图{loadingRefs ? '（绑定中…）' : ''}</span>
        <span style={{ fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: '#FFFFFF66' }}>{refImages.length}/{maxImages}</span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'flex-start' }}>
        {refImages.map((item, index) => (
          <RefImageItem
            key={item.id ?? item.url + index}
            url={item.url}
            onRemove={() => handleRemove(index)}
          />
        ))}
        {canAddMore && (
          <RefImageUploadCard
            onLocalUpload={() => fileInputRef.current?.click()}
            onAssetPick={() => setAssetPickerOpen(true)}
          />
        )}
      </div>
    </div>
  );
}
