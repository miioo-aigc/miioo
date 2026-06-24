import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FONT } from '../utils/fonts';
import AddSlotBtn from './AddSlotBtn';
import AddSlotDropdown from './AddSlotDropdown';
import AssetPickerModal from './AssetPickerModal';
import MediaHoverPreview from './MediaHoverPreview';
import { apiUploadCreationImage, apiUploadCreationVideo, apiUploadCreationAudio } from '../api/creation';

export default function MainRefCol({ shot, onChange, chars, projectId }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const [assetPickerOpen, setAssetPickerOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [previewImg, setPreviewImg] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const hoverTimerRef = useRef(null);
  const addBtnRef = useRef(null);
  const fileInputRef = useRef(null);

  function handleImgMouseEnter(e, img) {
    const { clientX, clientY } = e;
    setMousePos({ x: clientX, y: clientY });
    hoverTimerRef.current = setTimeout(() => {
      if (img?.url) setPreviewImg(img.url);
    }, 500);
  }

  function handleImgMouseMove(e) {
    setMousePos({ x: e.clientX, y: e.clientY });
  }

  function handleImgMouseLeave() {
    clearTimeout(hoverTimerRef.current);
    setPreviewImg(null);
  }

  function handleDelete(idx) {
    clearTimeout(hoverTimerRef.current);
    setPreviewImg(null);
    onChange({ ...shot, mainRefs: shot.mainRefs.filter((_, i) => i !== idx) });
  }

  async function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { alert('抱歉，平台暂不支持上传20M以上的图片资源！'); e.target.value = ''; return; }

    const localUrl = URL.createObjectURL(file);
    const tempRef = { id: localUrl, url: localUrl, name: file.name, type: file.type, uploading: true };
    const newRefs = [...shot.mainRefs, tempRef];
    onChange({ ...shot, mainRefs: newRefs });
    e.target.value = '';

    try {
      const isVideo = file.type.startsWith('video/');
      const isAudio = file.type.startsWith('audio/');
      const maxSize = isVideo ? 200 * 1024 * 1024 : isAudio ? 50 * 1024 * 1024 : 20 * 1024 * 1024;
      const typeLabel = isVideo ? '视频' : isAudio ? '音频' : '图片';
      if (file.size > maxSize) { alert(`抱歉，平台暂不支持上传${maxSize / 1024 / 1024}M以上的${typeLabel}资源！`); e.target.value = ''; return; }
      const uploadFn = isVideo ? apiUploadCreationVideo : isAudio ? apiUploadCreationAudio : apiUploadCreationImage;
      const result = await uploadFn({ file, category: 'reference', project_id: projectId });
      const uploadedUrl = result.uploaded_url || result.uploadedUrl || result.url || result.file_url || '';

      const updatedRefs = newRefs.map(ref =>
        ref.id === localUrl
          ? { id: result.asset_id || result.id || uploadedUrl, url: uploadedUrl, name: file.name, type: file.type, uploaded: true }
          : ref
      );

      onChange({ ...shot, mainRefs: updatedRefs });
    } catch (error) {
      console.error('上传失败', error);
      onChange({ ...shot, mainRefs: newRefs.filter(ref => ref.id !== localUrl) });
    }
  }

  function handleAssetConfirm(assets) {
    const newRefs = assets.map(a => ({ id: a.id, assetId: a.id, url: (a.fileUrl || a.url) ?? null, name: a.name, type: a.type ?? 'image' }));
    onChange({ ...shot, mainRefs: [...shot.mainRefs, ...newRefs] });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '92px', flexShrink: 0 }}>
      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileSelect} />
      <AssetPickerModal
        open={assetPickerOpen}
        projectId={projectId}
        onClose={() => setAssetPickerOpen(false)}
        preSelectedIds={shot.mainRefs.map(r => r.assetId).filter(Boolean)}
        preSelectedUrls={shot.mainRefs.map(r => r.url).filter(Boolean)}
        preSelectedSubjectIds={shot.mainRefs.map(r => r.id).filter(Boolean)}
        onConfirm={handleAssetConfirm}
      />
      {dropdownOpen && (
        <AddSlotDropdown
          anchorRef={addBtnRef}
          onUpload={() => fileInputRef.current?.click()}
          onAssetPicker={() => setAssetPickerOpen(true)}
          onClose={() => setDropdownOpen(false)}
        />
      )}

      <div style={{
        width: '92px',
        maxHeight: '92px',
        overflowY: 'auto',
        overflowX: 'hidden',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '4px',
        scrollbarWidth: 'none',
      }}>
        <div ref={addBtnRef} style={{ display: 'inline-flex', flexShrink: 0 }}>
          <AddSlotBtn onClick={() => setDropdownOpen((v) => !v)} />
        </div>
        {shot.mainRefs.map((img, idx) => (
          <div
            key={img.id ?? idx}
            onMouseEnter={(e) => { setHoveredIdx(idx); handleImgMouseEnter(e, img); }}
            onMouseLeave={() => { setHoveredIdx(null); handleImgMouseLeave(); }}
            onMouseMove={handleImgMouseMove}
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '4px',
              position: 'relative',
              overflow: 'hidden',
              flexShrink: 0,
              border: hoveredIdx === idx ? '1px solid #2DC3E1' : '1px solid rgba(255,255,255,0.06)',
              transition: 'border-color 150ms',
            }}
          >
            {img.url
              ? <img src={img.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <div style={{ width: '100%', height: '100%', backgroundColor: img.bgColor ?? '#252525', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.50)', fontFamily: FONT }}>{(img.name ?? '?')[0]}</span>
                </div>
            }
            {hoveredIdx === idx && (
              <div
                onClick={() => handleDelete(idx)}
                style={{
                  position: 'absolute', top: '2px', right: '2px',
                  width: '16px', height: '16px',
                  backgroundColor: 'rgba(0,0,0,0.70)',
                  borderRadius: '3px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M2 2L8 8M8 2L2 8" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
              </div>
            )}
          </div>
        ))}
      </div>

      {previewImg && createPortal(
        <MediaHoverPreview url={previewImg} isVideo={false} mouseX={mousePos.x} mouseY={mousePos.y} />,
        document.body
      )}
    </div>
  );
}
