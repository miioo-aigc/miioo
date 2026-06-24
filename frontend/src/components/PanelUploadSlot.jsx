import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FONT } from '../utils/fonts';
import AssetPickerModal from './AssetPickerModal';
import MediaHoverPreview from './MediaHoverPreview';
import { apiUploadCreationImage, apiUploadCreationVideo, apiUploadCreationAudio } from '../api/creation';

export default function PanelUploadSlot({ label, onUpload, media, onRemove, accept = 'image/*', projectId, countLabel, mediaList, canAddMore = true, onRemoveItem, onAssetConfirm, onInsert }) {
  const fileRef = useRef(null);
  const [hov, setHov] = useState(false);
  const [addHov, setAddHov] = useState(false);
  const [btn1Hov, setBtn1Hov] = useState(false);
  const [btn1Pressed, setBtn1Pressed] = useState(false);
  const [btn2Hov, setBtn2Hov] = useState(false);
  const [btn2Pressed, setBtn2Pressed] = useState(false);
  const [assetPickerOpen, setAssetPickerOpen] = useState(false);
  const [previewMedia, setPreviewMedia] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [uploading, setUploading] = useState(false);
  const hoverTimerRef = useRef(null);

  function startPreview(e, item) {
    const { clientX, clientY } = e;
    setMousePos({ x: clientX, y: clientY });
    clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => {
      if (item?.url) setPreviewMedia({ url: item.url, isVideo: !!item.type?.startsWith('video') });
    }, 500);
  }

  function movePreview(e) {
    setMousePos({ x: e.clientX, y: e.clientY });
  }

  function stopPreview() {
    clearTimeout(hoverTimerRef.current);
    setPreviewMedia(null);
  }

  const isMultiMode = Array.isArray(mediaList);

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

  const THUMB = 120;

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignSelf: 'stretch' }}>
        {(label || countLabel) && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            {label && <span style={{ fontSize: '14px', lineHeight: '18px', color: 'rgba(255,255,255,0.60)', fontFamily: FONT }}>{label}</span>}
            {countLabel && <span style={{ fontSize: '14px', lineHeight: '18px', color: 'rgba(255,255,255,0.35)', fontFamily: FONT, flexShrink: 0 }}>{countLabel}</span>}
          </div>
        )}

        {isMultiMode ? (
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <input ref={fileRef} type="file" accept={accept} style={{ display: 'none' }} onChange={handleFile} />
            {mediaList.map((item, idx) => (
              <div key={item.id || idx}
                onMouseEnter={(e) => startPreview(e, item)}
                onMouseMove={movePreview}
                onMouseLeave={stopPreview}
                style={{ position: 'relative', width: `${THUMB}px`, height: `${THUMB}px`, borderRadius: '6px', overflow: 'hidden', flexShrink: 0, border: '1px solid rgba(255,255,255,0.12)' }}>
                {item.type?.startsWith('video') ? (
                  <video src={item.url || null} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted playsInline />
                ) : item.type?.startsWith('audio') ? (
                  <div style={{ width: '100%', height: '100%', backgroundColor: '#1D1E1E', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M9 18V5l12-2v13" stroke="rgba(255,255,255,0.50)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><circle cx="6" cy="18" r="3" stroke="rgba(255,255,255,0.50)" strokeWidth="1.5"/><circle cx="18" cy="16" r="3" stroke="rgba(255,255,255,0.50)" strokeWidth="1.5"/></svg>
                  </div>
                ) : (
                  <img src={item.url || null} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                )}
                <div
                  onClick={() => { stopPreview(); onRemoveItem ? onRemoveItem(idx) : onRemove?.(); }}
                  style={{ position: 'absolute', top: '4px', right: '4px', width: '18px', height: '18px', borderRadius: '4px', backgroundColor: 'rgba(0,0,0,0.70)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 2L8 8M8 2L2 8" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round"/></svg>
                </div>
              </div>
            ))}
            {canAddMore && (
              <div
                onMouseEnter={() => setAddHov(true)}
                onMouseLeave={() => setAddHov(false)}
                style={{
                  width: `${THUMB}px`, height: `${THUMB}px`, borderRadius: '6px', flexShrink: 0,
                  border: `1px dashed ${addHov ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.08)'}`,
                  backgroundColor: '#1D1E1E',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  transition: 'border-color 0.12s', cursor: 'pointer',
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
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <input ref={fileRef} type="file" accept={accept} style={{ display: 'none' }} onChange={handleFile} />
            {media ? (
              <div
                onMouseDown={(e) => { if (onInsert) e.preventDefault(); }}
                onClick={() => onInsert?.(media)}
                onMouseEnter={(e) => startPreview(e, media)}
                onMouseMove={movePreview}
                onMouseLeave={stopPreview}
                style={{ position: 'relative', width: '120px', height: '120px', borderRadius: '6px', overflow: 'hidden', flexShrink: 0, border: `1px solid ${onInsert ? 'rgba(255,255,255,0.20)' : 'rgba(255,255,255,0.12)'}`, cursor: onInsert ? 'pointer' : 'default' }}>
                {media.type?.startsWith('video') ? (
                  <video src={media.url || null} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted playsInline />
                ) : media.type?.startsWith('audio') ? (
                  <div style={{ width: '100%', height: '100%', backgroundColor: '#1D1E1E', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M9 18V5l12-2v13" stroke="rgba(255,255,255,0.50)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><circle cx="6" cy="18" r="3" stroke="rgba(255,255,255,0.50)" strokeWidth="1.5"/><circle cx="18" cy="16" r="3" stroke="rgba(255,255,255,0.50)" strokeWidth="1.5"/></svg>
                    <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.40)', fontFamily: FONT, maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingInline: '4px' }}>{media.name}</span>
                  </div>
                ) : (
                  <img src={media.url || null} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                )}
                <div
                  onClick={() => { stopPreview(); onRemove?.(); }}
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
          </div>
        )}
      </div>
      <AssetPickerModal
        accept={accept.startsWith('video') ? 'video' : accept.startsWith('image') ? 'image' : accept.startsWith('audio') ? 'audio' : 'all'}
        open={assetPickerOpen}
        onClose={() => setAssetPickerOpen(false)}
        projectId={projectId}
        preSelectedIds={isMultiMode ? (mediaList || []).map(m => m.assetId || m.id).filter(id => id && !id.startsWith('blob:')) : (media?.assetId || (!media?.id?.startsWith('blob:') ? media?.id : null)) ? [media.assetId || media.id] : []}
        preSelectedUrls={isMultiMode ? (mediaList || []).map(m => m.url).filter(Boolean) : (media?.url ? [media.url] : [])}
        onConfirm={(assets) => { onAssetConfirm?.(assets); setAssetPickerOpen(false); }}
      />
      {previewMedia && createPortal(
        <MediaHoverPreview url={previewMedia.url} isVideo={previewMedia.isVideo} mouseX={mousePos.x} mouseY={mousePos.y} />,
        document.body
      )}
    </>
  );
}
