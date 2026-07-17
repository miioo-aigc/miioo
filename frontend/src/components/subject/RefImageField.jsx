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
 */
import { useEffect, useReducer, useRef, useState } from 'react';
import AssetPickerModal from '../AssetPickerModal';
import { apiBindSubjectReferenceImages, apiUploadSubjectReferenceImage } from '../../api/subject';
import { normalizeImageUrl } from '../../utils/imageUrl';
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
    const tempId = `upload-${Date.now()}`;
    const newList = [...refImages, { url: blobUrl, id: tempId }].slice(0, maxImages);
    dispatchRefImages({ type: 'replace', items: newList });

    if (projectId && subjectId) {
      apiUploadSubjectReferenceImage(projectId, subjectId, file)
        .then((res) => {
          const realId = res?.asset_id || res?.id;
          const rawUrl = res?.file_url || res?.url;
          const realUrl = normalizeImageUrl(rawUrl) || rawUrl;
          if (realId && realUrl) {
            dispatchRefImages({ type: 'replaceById', id: tempId, patch: { id: realId, url: realUrl, assetId: realId } });
            onRefImagesChange?.(newList.map((image) => image.id === tempId ? realUrl : (image.url || image.id)));
          }
        })
        .catch((error) => {
          console.error('[RefImageField] 上传参考图失败:', error);
          dispatchRefImages({ type: 'removeById', id: tempId });
        });
    }
  }

  function handleAssetConfirm(selectedAssets) {
    const assetIds = selectedAssets.map((asset) => asset.id);
    const newList = [
      ...refImages,
      ...selectedAssets.map((asset) => ({
        url: normalizeImageUrl(asset.fileUrl || asset.originalUrl || asset.original_url || asset.thumbnailUrl || asset.thumbnail_url || asset.url || asset.file_url),
        id: asset.id,
        assetId: asset.id,
      })),
    ].slice(0, maxImages);
    dispatchRefImages({ type: 'replace', items: newList });
    setAssetPickerOpen(false);

    if (projectId && subjectId && assetIds.length > 0) {
      setLoadingRefs(true);
      apiBindSubjectReferenceImages(projectId, subjectId, { asset_ids: assetIds })
        .then(() => onRefImagesChange?.(newList.map((image) => image.url || image.id)))
        .catch((error) => console.error('[RefImageField] 绑定参考图失败:', error))
        .finally(() => setLoadingRefs(false));
    }
  }

  function handleRemove(index) {
    const newList = refImages.filter((_, itemIndex) => itemIndex !== index);
    dispatchRefImages({ type: 'replace', items: newList });
    onRefImagesChange?.(newList.map((image) => image.url || image.id));
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
