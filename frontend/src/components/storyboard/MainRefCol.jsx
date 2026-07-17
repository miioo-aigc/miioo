import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import AssetPickerModal from '../AssetPickerModal';
import { normalizeImageUrl } from '../../utils/imageUrl';

/**
 * @file MainRefCol.jsx
 * @structure-index
 *
 * ─── 主体参考列组件 ───────────────────────────────────────────────
 *   MainRefColWrapper       标题、边框和列布局容器
 *   MainRefCol               主体参考图网格、添加菜单、资产选择和删除交互
 *   AddSlotDropdown          本地上传/资产库选择菜单
 *   MediaHoverPreview        图片/视频悬浮预览
 *   StoryboardAddSlotButton   主体参考列的虚线添加格
 *
 * ─── 依赖边界 ─────────────────────────────────────────────────────
 *   通过 props 接收 shot、onChange、onUploadFile 和 onAssetConfirm；
 *   上传 API、资产字段映射、页面状态、Toast 和持久化副作用由页面负责。
 *   组件不读取 StoryboardPage 的闭包变量，不直接调用业务 API。
 *
 * ─── 更新记录 ─────────────────────────────────────────────────────
 *   2026-07-15  抽离 StoryboardPage 主体参考列，保留临时预览、资产选择、删除和悬浮预览行为
 */

const FONT = '"Alibaba PuHuiTi 2.0", system-ui, sans-serif';

function IconPlus({ color = '#FFFFFF40' }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M7 2V12M2 7H12" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function StoryboardAddSlotButton({ onClick }) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') onClick?.();
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      style={{
        width: '44px',
        height: '44px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '4px',
        backgroundColor: pressed ? 'rgba(255,255,255,0.08)' : hovered ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.03)',
        border: `1px dashed ${hovered ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.12)'}`,
        cursor: 'pointer',
        flexShrink: 0,
        transition: 'background-color 0.12s, border-color 0.12s',
      }}
    >
      <IconPlus color={hovered ? 'rgba(255,255,255,0.70)' : undefined} />
    </div>
  );
}

function AddSlotDropdown({ anchor, onUpload, onAssetPicker, onClose }) {
  const menuRef = useRef(null);
  const [hoveredIndex, setHoveredIndex] = useState(null);

  useEffect(() => {
    function handleOutsideMouseDown(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        onClose();
      }
    }

    document.addEventListener('mousedown', handleOutsideMouseDown);
    return () => document.removeEventListener('mousedown', handleOutsideMouseDown);
  }, [onClose]);

  if (!anchor) return null;

  const items = [
    { label: '本地上传', action: onUpload },
    { label: '从资产库选择', action: onAssetPicker },
  ];

  return createPortal(
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        top: anchor.bottom + 4,
        left: anchor.left,
        zIndex: 9999,
        backgroundColor: '#1D1E1E',
        border: '1px solid rgba(255,255,255,0.10)',
        borderRadius: '8px',
        padding: '4px',
        boxShadow: '0px 4px 16px rgba(0,0,0,0.50)',
        minWidth: '120px',
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
      }}
    >
      {items.map((item, index) => (
        <div
          key={item.label}
          role="menuitem"
          onMouseEnter={() => setHoveredIndex(index)}
          onMouseLeave={() => setHoveredIndex(null)}
          onMouseDown={(event) => {
            event.preventDefault();
            item.action?.();
            onClose();
          }}
          style={{
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            paddingInline: '10px',
            borderRadius: '6px',
            cursor: 'pointer',
            backgroundColor: hoveredIndex === index ? 'rgba(255,255,255,0.08)' : 'transparent',
            fontSize: '13px',
            color: hoveredIndex === index ? '#FFFFFF' : 'rgba(255,255,255,0.70)',
            fontFamily: FONT,
            whiteSpace: 'nowrap',
            transition: 'background-color 0.10s, color 0.10s',
          }}
        >
          {item.label}
        </div>
      ))}
    </div>,
    document.body,
  );
}

function MainRefCol({ shot, onChange, projectId, onUploadFile, onAssetConfirm }) {
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [assetPickerOpen, setAssetPickerOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [dropdownAnchor, setDropdownAnchor] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const hoverTimerRef = useRef(null);
  const addButtonRef = useRef(null);
  const fileInputRef = useRef(null);

  function handleImageMouseEnter(event, image) {
    setMousePosition({ x: event.clientX, y: event.clientY });
    hoverTimerRef.current = setTimeout(() => {
      if (image?.url) setPreviewImage(image.url);
    }, 500);
  }

  function handleImageMouseMove(event) {
    setMousePosition({ x: event.clientX, y: event.clientY });
  }

  function handleImageMouseLeave() {
    clearTimeout(hoverTimerRef.current);
    setPreviewImage(null);
  }

  function handleDelete(index) {
    clearTimeout(hoverTimerRef.current);
    setPreviewImage(null);
    onChange({ ...shot, mainRefs: shot.mainRefs.filter((_, itemIndex) => itemIndex !== index) });
  }

  async function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      alert('抱歉，平台暂不支持上传20M以上的图片资源！');
      event.target.value = '';
      return;
    }

    const localUrl = URL.createObjectURL(file);
    const tempRef = { id: localUrl, url: localUrl, name: file.name, type: file.type, uploading: true };
    const nextRefs = [...shot.mainRefs, tempRef];
    onChange({ ...shot, mainRefs: nextRefs });
    event.target.value = '';

    try {
      await onUploadFile?.({ file, tempRef, nextRefs });
    } catch (error) {
      console.error('上传失败', error);
      onChange({ ...shot, mainRefs: nextRefs.filter((ref) => ref.id !== localUrl) });
    }
  }

  function handleAssetConfirm(assets) {
    onAssetConfirm?.(assets);
    setAssetPickerOpen(false);
  }

  function handleAddButtonClick() {
    if (dropdownOpen) {
      setDropdownOpen(false);
      setDropdownAnchor(null);
      return;
    }

    setDropdownAnchor(addButtonRef.current?.getBoundingClientRect() ?? null);
    setDropdownOpen(true);
  }

  function handleDropdownClose() {
    setDropdownOpen(false);
    setDropdownAnchor(null);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '92px', flexShrink: 0 }}>
      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileSelect} />
      <AssetPickerModal
        open={assetPickerOpen}
        projectId={projectId}
        onClose={() => setAssetPickerOpen(false)}
        preSelectedIds={shot.mainRefs.map((ref) => ref.assetId).filter(Boolean)}
        preSelectedUrls={shot.mainRefs.map((ref) => ref.url).filter(Boolean)}
        preSelectedSubjectIds={shot.mainRefs.map((ref) => ref.subjectId || ((ref.type === 'char' || ref.type === 'scene' || ref.type === 'prop') ? ref.id : null)).filter(Boolean)}
        onConfirm={handleAssetConfirm}
      />
      {dropdownOpen && (
        <AddSlotDropdown
          anchor={dropdownAnchor}
          onUpload={() => fileInputRef.current?.click()}
          onAssetPicker={() => setAssetPickerOpen(true)}
          onClose={handleDropdownClose}
        />
      )}

      <div style={{ width: '92px', maxHeight: '92px', overflowY: 'auto', overflowX: 'hidden', display: 'flex', flexWrap: 'wrap', gap: '4px', scrollbarWidth: 'none' }}>
        <div ref={addButtonRef} style={{ display: 'inline-flex', flexShrink: 0 }}>
          <StoryboardAddSlotButton onClick={handleAddButtonClick} />
        </div>
        {shot.mainRefs.map((image, index) => (
          <div
            key={image.id ?? index}
            onMouseEnter={(event) => { setHoveredIndex(index); handleImageMouseEnter(event, image); }}
            onMouseLeave={() => { setHoveredIndex(null); handleImageMouseLeave(); }}
            onMouseMove={handleImageMouseMove}
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '4px',
              position: 'relative',
              overflow: 'hidden',
              flexShrink: 0,
              border: hoveredIndex === index ? '1px solid #2DC3E1' : '1px solid rgba(255,255,255,0.06)',
              transition: 'border-color 150ms',
            }}
          >
            {image.url ? (
              <img src={normalizeImageUrl(image.url)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div style={{ width: '100%', height: '100%', backgroundColor: image.bgColor ?? '#252525', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.50)', fontFamily: FONT }}>{(image.name ?? '?')[0]}</span>
              </div>
            )}
            {hoveredIndex === index && (
              <div
                role="button"
                tabIndex={0}
                onClick={() => handleDelete(index)}
                onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') handleDelete(index); }}
                style={{ position: 'absolute', top: '2px', right: '2px', width: '16px', height: '16px', backgroundColor: 'rgba(0,0,0,0.70)', borderRadius: '3px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                  <path d="M2 2L8 8M8 2L2 8" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
              </div>
            )}
          </div>
        ))}
      </div>

      {previewImage && createPortal(
        <MediaHoverPreview url={previewImage} isVideo={false} mouseX={mousePosition.x} mouseY={mousePosition.y} />,
        document.body,
      )}
    </div>
  );
}

export function MediaHoverPreview({ url, isVideo, mouseX, mouseY }) {
  const [loadedMedia, setLoadedMedia] = useState(null);
  const GAP = 16;
  const mediaKey = `${isVideo ? 'video' : 'image'}:${url}`;

  useEffect(() => {
    if (isVideo || !url) return undefined;

    const image = new Image();
    image.onload = () => {
      if (image.naturalWidth && image.naturalHeight) {
        setLoadedMedia({
          key: mediaKey,
          size: { w: image.naturalWidth, h: image.naturalHeight },
        });
      }
    };
    image.src = normalizeImageUrl(url);
    return () => { image.onload = null; };
  }, [url, isVideo, mediaKey]);

  const size = isVideo
    ? (loadedMedia?.key === mediaKey ? loadedMedia.size : { w: 16, h: 9 })
    : loadedMedia?.key === mediaKey ? loadedMedia.size : null;

  if (!size) return null;

  const maxW = window.innerWidth * 0.35;
  const maxH = window.innerHeight * 0.35;
  const ratio = size.w / size.h;
  let previewW;
  let previewH;

  if (ratio >= 1) {
    previewW = maxW;
    previewH = previewW / ratio;
    if (previewH > maxH) { previewH = maxH; previewW = previewH * ratio; }
  } else {
    previewH = maxH;
    previewW = previewH * ratio;
    if (previewW > maxW) { previewW = maxW; previewH = previewW / ratio; }
  }

  let left = mouseX + GAP;
  let top = mouseY + GAP;
  if (left + previewW > window.innerWidth - GAP) left = mouseX - previewW - GAP;
  if (top + previewH > window.innerHeight - GAP) top = mouseY - previewH - GAP;
  left = Math.max(GAP, left);
  top = Math.max(GAP, top);

  return (
    <div style={{ position: 'fixed', left, top, width: previewW, height: previewH, zIndex: 99999, pointerEvents: 'none', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.7)', border: '1px solid rgba(255,255,255,0.12)', backgroundColor: '#111' }}>
      {isVideo ? (
        <video src={normalizeImageUrl(url)} autoPlay loop muted playsInline onLoadedMetadata={(event) => { const { videoWidth: w, videoHeight: h } = event.target; if (w && h) setLoadedMedia({ key: mediaKey, size: { w, h } }); }} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      ) : (
        <img src={normalizeImageUrl(url)} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      )}
    </div>
  );
}

export default function MainRefColWrapper({ shot, onChange, projectId, onUploadFile, onAssetConfirm }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', borderRight: '1px solid rgba(255,255,255,0.08)', alignItems: 'flex-start', flexShrink: 0 }}>
      <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.60)', fontFamily: FONT }}>主体参考</span>
      <MainRefCol
        shot={shot}
        onChange={onChange}
        projectId={projectId}
        onUploadFile={onUploadFile}
        onAssetConfirm={onAssetConfirm}
      />
    </div>
  );
}
