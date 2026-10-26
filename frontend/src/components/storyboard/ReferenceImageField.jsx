/**
 * @file ReferenceImageField.jsx
 * @structure-index
 *
 * ─── 组件职责 ───────────────────────────────────────────────────────
 *   展示图片参考素材、上传入口、删除操作和悬浮预览
 *
 * ─── 依赖边界 ───────────────────────────────────────────────────────
 *   只接收素材、数量和显式回调；不调用 API、不读取 Store、不处理资产绑定
 *
 *   2026-10-26  悬停预览失败固定浮层并就地刷新，正常移出及素材移除行为保留
 *
 * ─── 更新记录 ───────────────────────────────────────────────────────
 *   2026-09-16         参考图移除按钮统一为悬停显示的叉号
 *   2026-08-05         参考图展示键兼容重复资产 ID，避免 React 列表键冲突
 *   2026-10-26  固定媒体框接入有限恢复；刷新与业务操作隔离。
 * 当前定义定位：ReferenceImageField L27。
 */
import StoryboardMediaPreview from './StoryboardMediaPreview';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import MediaHoverPreview from './MediaHoverPreview';
import { useHoverPreviewBoundary } from '../../hooks/useHoverPreviewBoundary';
import FileUploadButton from '../ui/FileUploadButton';
import { ReferenceRemoveButton } from '../ui';

export default function ReferenceImageField({
  images = [],
  countLabel,
  canAdd = true,
  onFilesSelected,
  onRemove,
  onOpenAssetPicker,
}) {
  const fileRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const hoverTimerRef = useRef(null);
  const hoverBoundary = useHoverPreviewBoundary(() => setPreview(null));
  useEffect(() => () => clearTimeout(hoverTimerRef.current), []);

  function handleFileChange(event) {
    const files = Array.from(event.target.files || []);
    if (files.length) onFilesSelected?.(files);
    event.target.value = '';
  }

  function handleMouseEnter(event, image) {
    hoverBoundary.enter();
    clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => {
      if (image.url) setPreview({ url: image.url, x: event.clientX, y: event.clientY });
    }, 500);
  }

  function handleMouseMove(event) {
    setPreview((current) => current ? { ...current, x: event.clientX, y: event.clientY } : current);
  }

  function handleMouseLeave() {
    clearTimeout(hoverTimerRef.current);
    hoverBoundary.leave();
  }

  function getRenderKey(image, index) {
    // 参考图可能来自主体引用和资产库，历史数据中两者可能共享同一个 id。
    // 展示键必须保证当前渲染批次唯一，业务删除仍使用原始 image.id。
    const identity = image?.id || image?.assetId || image?.url || 'reference';
    return `${identity}:${image?.url || 'no-url'}:${index}`;
  }

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignSelf: 'stretch' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '14px', lineHeight: '18px', color: 'rgba(255,255,255,0.60)' }}>参考图</span>
          {countLabel && <span style={{ fontSize: '14px', lineHeight: '18px', color: 'rgba(255,255,255,0.40)' }}>{countLabel}</span>}
        </div>
        {canAdd && <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleFileChange} />}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {images.map((image, index) => (
            <div key={getRenderKey(image, index)} onMouseEnter={(event) => { setHoveredIndex(index); handleMouseEnter(event, image); }} onMouseMove={handleMouseMove} onMouseLeave={() => { setHoveredIndex(null); handleMouseLeave(); }} style={{ position: 'relative', width: '120px', height: '120px', borderRadius: '6px', overflow: 'hidden', flexShrink: 0, border: '1px solid rgba(255,255,255,0.12)' }}>
              <StoryboardMediaPreview media={image} />
              <ReferenceRemoveButton visible={hoveredIndex === index} ariaLabel="移除参考图" onClick={() => { clearTimeout(hoverTimerRef.current); hoverBoundary.dismiss(); onRemove?.(image.id); }} />
            </div>
          ))}
          {canAdd && (
            <div style={{ width: '120px', height: '120px', borderRadius: '6px', flexShrink: 0, border: '1px dashed rgba(255,255,255,0.08)', backgroundColor: '#1D1E1E', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <FileUploadButton onClick={() => fileRef.current?.click()}>本地上传</FileUploadButton>
              <FileUploadButton onClick={onOpenAssetPicker}>从资产库选择</FileUploadButton>
            </div>
          )}
        </div>
      </div>
      {preview && createPortal(<MediaHoverPreview onPinnedChange={hoverBoundary.pin} onDismiss={hoverBoundary.dismiss} url={preview.url} isVideo={false} mouseX={preview.x} mouseY={preview.y} />, document.body)}
    </>
  );
}
