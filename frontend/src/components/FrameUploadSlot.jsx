import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FONT } from '../utils/fonts';
import AssetPickerModal from './AssetPickerModal';
import MediaHoverPreview from './MediaHoverPreview';
import { apiUploadCreationImage, apiUploadCreationVideo, apiUploadCreationAudio } from '../api/creation';

export default function FrameUploadSlot({ label, media, onUpload, onRemove, shortcutLabel, shortcutImage, shortcutTooltip, projectId }) {
  const fileRef = useRef(null);
  const [hov, setHov] = useState(false);
  const [btn1Hov, setBtn1Hov] = useState(false);
  const [btn1Pressed, setBtn1Pressed] = useState(false);
  const [btn2Hov, setBtn2Hov] = useState(false);
  const [btn2Pressed, setBtn2Pressed] = useState(false);
  const [btn3Hov, setBtn3Hov] = useState(false);
  const [btn3Pressed, setBtn3Pressed] = useState(false);
  const [assetPickerOpen, setAssetPickerOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewPos, setPreviewPos] = useState(null);
  const hoverTimerRef = useRef(null);

  function handleMediaMouseEnter(e) {
    const { clientX, clientY } = e;
    clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => {
      if (media?.url) setPreviewPos({ x: clientX, y: clientY });
    }, 500);
  }

  function handleMediaMouseMove(e) {
    setPreviewPos(p => p ? { x: e.clientX, y: e.clientY } : p);
  }

  function handleMediaMouseLeave() {
    clearTimeout(hoverTimerRef.current);
    setPreviewPos(null);
  }

  async function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const isVideo = file.type.startsWith('video/');
    const isAudio = file.type.startsWith('audio/');
    const maxSize = isVideo ? 200 * 1024 * 1024 : isAudio ? 50 * 1024 * 1024 : 20 * 1024 * 1024;
    const typeLabel = isVideo ? '视频' : isAudio ? '音频' : '图片';
    if (file.size > maxSize) { alert(`抱歉，平台暂不支持上传${maxSize / 1024 / 1024}M以上的${typeLabel}资源！`); e.target.value = ''; return; }
    setUploading(true);
    try {
      const uploadFn = isVideo ? apiUploadCreationVideo : isAudio ? apiUploadCreationAudio : apiUploadCreationImage;
      const result = await uploadFn({ file, category: 'reference', project_id: projectId });
      const url = result.uploaded_url || result.uploadedUrl || result.url || result.file_url || '';
      onUpload?.({ id: url, url, name: file.name, type: file.type });
    } catch {
      alert('上传失败，请重试');
    }
    setUploading(false);
    e.target.value = '';
  }

  function handleShortcut() {
    if (!shortcutImage) return;
    onUpload?.(shortcutImage);
  }

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignSelf: 'stretch' }}>
        {label && <span style={{ fontSize: '14px', lineHeight: '18px', color: 'rgba(255,255,255,0.60)', fontFamily: FONT }}>{label}</span>}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
          {media ? (
            <div
              onMouseEnter={handleMediaMouseEnter}
              onMouseMove={handleMediaMouseMove}
              onMouseLeave={handleMediaMouseLeave}
              style={{ position: 'relative', width: '120px', height: '120px', borderRadius: '6px', overflow: 'hidden', flexShrink: 0, border: '1px solid rgba(255,255,255,0.12)' }}>
              <img src={media.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <div
                onClick={() => { clearTimeout(hoverTimerRef.current); setPreviewPos(null); onRemove?.(); }}
                style={{ position: 'absolute', top: '4px', right: '4px', width: '18px', height: '18px', borderRadius: '4px', backgroundColor: 'rgba(0,0,0,0.70)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 2L8 8M8 2L2 8" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round"/></svg>
              </div>
            </div>
          ) : (
            <div
              onMouseEnter={() => setHov(true)}
              onMouseLeave={() => setHov(false)}
              style={{
                width: '120px', height: '120px', borderRadius: '6px', flexShrink: 0,
                border: `1px dashed ${hov ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.08)'}`,
                backgroundColor: '#1D1E1E',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px',
                transition: 'border-color 0.12s',
              }}
            >
              <div
                onClick={() => fileRef.current?.click()}
                onMouseEnter={() => setBtn1Hov(true)}
                onMouseLeave={() => { setBtn1Hov(false); setBtn1Pressed(false); }}
                onMouseDown={() => setBtn1Pressed(true)}
                onMouseUp={() => setBtn1Pressed(false)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', height: '24px', paddingInline: '6px', borderRadius: '6px',
                  backgroundColor: btn1Pressed ? '#1a1a1a' : btn1Hov ? '#222323' : '#161616',
                  border: '1px solid rgba(255,255,255,0.08)', outline: '1px solid #00000080',
                  cursor: 'pointer', fontSize: '12px', color: btn1Hov ? 'rgba(255,255,255,0.70)' : 'rgba(255,255,255,0.40)',
                  fontFamily: FONT, whiteSpace: 'nowrap', transition: 'background-color 0.10s, color 0.10s',
                }}
              >
                本地上传
              </div>
              <div
                onClick={() => setAssetPickerOpen(true)}
                onMouseEnter={() => setBtn2Hov(true)}
                onMouseLeave={() => { setBtn2Hov(false); setBtn2Pressed(false); }}
                onMouseDown={() => setBtn2Pressed(true)}
                onMouseUp={() => setBtn2Pressed(false)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', height: '24px', paddingInline: '6px', borderRadius: '6px',
                  backgroundColor: btn2Pressed ? '#1a1a1a' : btn2Hov ? '#222323' : '#161616',
                  border: '1px solid rgba(255,255,255,0.08)', outline: '1px solid #00000080',
                  cursor: 'pointer', fontSize: '12px', color: btn2Hov ? 'rgba(255,255,255,0.70)' : 'rgba(255,255,255,0.40)',
                  fontFamily: FONT, whiteSpace: 'nowrap', transition: 'background-color 0.10s, color 0.10s',
                }}
              >
                从资产库选择
              </div>
            </div>
          )}
          {!media && (
            <div style={{ position: 'relative' }}>
              <div
                onClick={shortcutImage ? handleShortcut : undefined}
                onMouseEnter={() => setBtn3Hov(true)}
                onMouseLeave={() => { setBtn3Hov(false); setBtn3Pressed(false); }}
                onMouseDown={() => shortcutImage ? setBtn3Pressed(true) : undefined}
                onMouseUp={() => setBtn3Pressed(false)}
                style={{
                  width: '120px', height: '120px', borderRadius: '6px', flexShrink: 0,
                  border: `1px dashed ${btn3Hov && shortcutImage ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.08)'}`,
                  backgroundColor: '#1D1E1E',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  cursor: shortcutImage ? 'pointer' : 'default',
                  transition: 'border-color 0.12s',
                  padding: '8px',
                }}
              >
                {shortcutImage ? (
                  <>
                    <div style={{ width: '72px', height: '40px', borderRadius: '4px', overflow: 'hidden', flexShrink: 0, border: '1px solid rgba(255,255,255,0.12)', opacity: btn3Hov ? 1 : 0.6, transition: 'opacity 0.12s' }}>
                      <img src={shortcutImage.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                    <span style={{ fontSize: '12px', lineHeight: '16px', color: 'rgba(255,255,255,0.40)', fontFamily: FONT, textAlign: 'center' }}>{shortcutLabel}</span>
                  </>
                ) : (
                  <>
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <rect x="2" y="4" width="16" height="12" rx="2" stroke="rgba(255,255,255,0.15)" strokeWidth="1.2"/>
                      <circle cx="7" cy="8.5" r="1.5" stroke="rgba(255,255,255,0.15)" strokeWidth="1.2"/>
                      <path d="M2 13l4-3 3 2.5 3-4 4 4.5" stroke="rgba(255,255,255,0.15)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span style={{ fontSize: '11px', lineHeight: '14px', color: 'rgba(255,255,255,0.20)', fontFamily: FONT, textAlign: 'center' }}>{shortcutLabel}</span>
                  </>
                )}
              </div>
              {!shortcutImage && shortcutTooltip && btn3Hov && (
                <div style={{
                  position: 'absolute', bottom: 'calc(100% + 6px)', left: '50%', transform: 'translateX(-50%)',
                  backgroundColor: '#2A2B2B', border: '1px solid rgba(255,255,255,0.10)', borderRadius: '6px',
                  padding: '6px 10px', whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 9999,
                  fontSize: '12px', lineHeight: '18px', color: 'rgba(255,255,255,0.60)', fontFamily: FONT,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.40)',
                }}>
                  {shortcutTooltip}
                  <div style={{
                    position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
                    width: 0, height: 0,
                    borderLeft: '5px solid transparent', borderRight: '5px solid transparent',
                    borderTop: '5px solid #2A2B2B',
                  }} />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <AssetPickerModal accept="image" open={assetPickerOpen} onClose={() => setAssetPickerOpen(false)} projectId={projectId} onConfirm={(assets) => {
        if (assets?.length) {
          const a = assets[0];
          onUpload?.({ id: a.id, url: a.fileUrl || a.originalUrl || a.original_url || a.thumbnailUrl || a.thumbnail_url || a.url || a.file_url || '', name: a.name || a.filename || '' });
        }
        setAssetPickerOpen(false);
      }} />
      {previewPos && media?.url && createPortal(
        <MediaHoverPreview url={media.url} isVideo={false} mouseX={previewPos.x} mouseY={previewPos.y} />,
        document.body
      )}
    </>
  );
}
