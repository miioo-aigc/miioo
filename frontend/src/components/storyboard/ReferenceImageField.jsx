/**
 * @file ReferenceImageField.jsx
 * @structure-index
 *
 * ─── 组件职责 ───────────────────────────────────────────────────────
 *   展示图片参考素材、上传入口、删除操作和悬浮预览
 *
 * ─── 依赖边界 ───────────────────────────────────────────────────────
 *   只接收素材、数量和显式回调；不调用 API、不读取 Store、不处理资产绑定
 */
import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MediaHoverPreview } from './MainRefCol';

export default function ReferenceImageField({
  images = [],
  countLabel,
  canAdd = true,
  onFilesSelected,
  onRemove,
  onOpenAssetPicker,
  RefSlotBtn,
}) {
  const fileRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const hoverTimerRef = useRef(null);

  function handleFileChange(event) {
    const files = Array.from(event.target.files || []);
    if (files.length) onFilesSelected?.(files);
    event.target.value = '';
  }

  function handleMouseEnter(event, image) {
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
    setPreview(null);
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
          {images.map((image) => (
            <div key={image.id} onMouseEnter={(event) => handleMouseEnter(event, image)} onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave} style={{ position: 'relative', width: '120px', height: '120px', borderRadius: '6px', overflow: 'hidden', flexShrink: 0, border: '1px solid rgba(255,255,255,0.12)' }}>
              <img src={image.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <button type="button" aria-label="删除参考图" onClick={() => { handleMouseLeave(); onRemove?.(image.id); }} style={{ position: 'absolute', top: '4px', right: '4px', width: '18px', height: '18px', border: 0, borderRadius: '4px', backgroundColor: 'rgba(0,0,0,0.70)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true"><path d="M2 2L8 8M8 2L2 8" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round" /></svg>
              </button>
            </div>
          ))}
          {canAdd && (
            <div style={{ width: '120px', height: '120px', borderRadius: '6px', flexShrink: 0, border: '1px dashed rgba(255,255,255,0.08)', backgroundColor: '#1D1E1E', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <RefSlotBtn onClick={() => fileRef.current?.click()}>本地上传</RefSlotBtn>
              <RefSlotBtn onClick={onOpenAssetPicker}>从资产库选择</RefSlotBtn>
            </div>
          )}
        </div>
      </div>
      {preview && createPortal(<MediaHoverPreview url={preview.url} isVideo={false} mouseX={preview.x} mouseY={preview.y} />, document.body)}
    </>
  );
}
