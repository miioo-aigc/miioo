import { useState, useEffect } from "react";
import { FONT } from "../../utils/fonts";
import RefImageUploadCard from "./RefImageUploadCard";

export default 
function RefImageField({ maxImages = 3, projectId, subjectId, refImageIds = [], onRefImagesChange }) {
  const fileInputRef = useRef(null);
  const [refImages, setRefImages] = useState([]);
  const [assetPickerOpen, setAssetPickerOpen] = useState(false);
  const [loadingRefs, setLoadingRefs] = useState(false);

  // 当外部 refImageIds 变化时，更新参考图列表
  // refImageIds 可以是：
  //   - { id, url }[]  — 从后端加载后的对象（新格式）
  //   - string[]       — 纯 asset_id（兼容旧调用路径）
  useEffect(() => {
    if (!refImageIds || refImageIds.length === 0) {
      setRefImages([]);
      return;
    }
    setRefImages(prev => {
      return refImageIds.map(item => {
        // 新格式：{ id, url }
        if (item && typeof item === 'object' && item.id) {
          const existing = prev.find(p => p?.id === item.id);
          return existing?.url ? existing : { id: item.id, url: item.url || null };
        }
        // 旧格式：纯字符串 id 或 URL
        const id = item;
        const existing = prev.find(p => p?.id === id);
        if (existing?.url) return existing;
        if (typeof id === 'string' && (id.startsWith('http') || id.startsWith('blob'))) {
          return { url: id, id };
        }
        return { id, url: null };
      });
    });
  }, [JSON.stringify(refImageIds)]);

  const canAddMore = refImages.length < maxImages;

  const handleFile = (file) => {
    if (file.size > 20 * 1024 * 1024) {
      alert('抱歉，平台暂不支持上传20M以上的图片资源！');
      return;
    }
    const url = URL.createObjectURL(file);
    const newList = [...refImages, { url, id: url }].slice(0, maxImages);
    setRefImages(newList);
    // 通知父组件：上传本地文件作为参考图
    if (onRefImagesChange) {
      onRefImagesChange(newList.map(r => r.url));
    }
  };

  const handleAssetConfirm = (selectedAssets) => {
    // 从资产库选择了资产，需要绑定到主体
    const assetIds = selectedAssets.map(a => a.id);
    const newList = [
      ...refImages,
      ...selectedAssets.map(a => ({ url: normalizeImageUrl(a.fileUrl || a.originalUrl || a.original_url || a.thumbnailUrl || a.thumbnail_url || a.url || a.file_url), id: a.id, assetId: a.id })),
    ].slice(0, maxImages);
    setRefImages(newList);
    setAssetPickerOpen(false);

    // 调用后端绑定参考图接口
    if (projectId && subjectId && assetIds.length > 0) {
      setLoadingRefs(true);
      apiBindSubjectReferenceImages(projectId, subjectId, { asset_ids: assetIds })
        .then(() => {
          if (onRefImagesChange) {
            onRefImagesChange(newList.map(r => r.id));
          }
        })
        .catch((err) => {
          console.error('[SubjectPage] 绑定参考图失败:', err);
        })
        .finally(() => setLoadingRefs(false));
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <AssetPickerModal
        accept="image"
        open={assetPickerOpen}
        onClose={() => setAssetPickerOpen(false)}
        onConfirm={handleAssetConfirm}
        projectId={projectId}
        preSelectedIds={refImages.map(img => img.assetId).filter(Boolean)}
        preSelectedUrls={refImages.map(img => img.url).filter(Boolean)}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); e.target.value = ''; }}
      />
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
        <span style={{ flex: 1, fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: '#FFFFFF99' }}>参考图{loadingRefs ? '（绑定中…）' : ''}</span>
        <span style={{ fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: '#FFFFFF66' }}>{refImages.length}/{maxImages}</span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'flex-start' }}>
        {refImages.map((item, i) => (
          <RefImageItem
            key={item.id ?? item.url + i}
            url={item.url}
            onRemove={() => {
              const newList = refImages.filter((_, idx) => idx !== i);
              setRefImages(newList);
              if (onRefImagesChange) onRefImagesChange(newList.map(r => r.id));
            }}
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
