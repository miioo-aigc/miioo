import { useState, useRef, useEffect } from 'react';
import { FONT, FONT_MEDIUM } from '../../utils/fonts';
import MoreMenu from './MoreMenu';
import ShotDetailModal from './ShotDetailModal';
import ShotVideoDetailModal from './ShotVideoDetailModal';
import SubjectAssetDetailModal from './SubjectAssetDetailModal';
import ImageDetailModal from '../../components/ImageDetailModal';

export default function ProjectAssetCard({ name, desc, url, selected, batchMode, onDownload, onDelete, onSelect, onShowToast, asset = {}, category = '' }) {
  const [hov, setHov] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);

  const images = asset.images ?? [];
  const imageCount = asset.imageCount ?? 1;
  const isVideo = category === 'storyboard_video';
  const videoRef = useRef(null);

  const isStoryboard = category === 'storyboard_img' || category === 'storyboard_video';
  const cardAspectRatio = isStoryboard ? '16/9' : '200/246';

  // 视频悬停播放
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    if (hov && isVideo) {
      vid.currentTime = 0;
      vid.play().catch(() => {});
    } else {
      vid.pause();
    }
  }, [hov, isVideo]);

  function handleClick() {
    if (batchMode) { onSelect?.(); return; }
    setDetailOpen(true);
  }

  return (
    <>
      <div
        style={{
          width: '100%',
          aspectRatio: cardAspectRatio,
          borderRadius: '12px',
          overflow: 'hidden',
          backgroundColor: '#1A1A1A',
          border: selected ? '1px solid #2DC3E1' : '1px solid #FFFFFF14',
          outline: hov && !selected ? '1px solid #FFFFFF26' : '1px solid transparent',
          transition: 'outline-color 0.15s, border-color 0.15s',
          cursor: 'pointer',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
        }}
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        onClick={handleClick}
      >
        {/* image/video area */}
        <div
          style={{
            flex: 1,
            position: 'relative',
            backgroundColor: '#1A1A1A',
            transition: 'background-color 0.15s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          {isVideo && asset.videoUrl ? (
            <video
              ref={videoRef}
              src={asset.videoUrl}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              muted
              playsInline
              loop
              preload="metadata"
            />
          ) : url ? (
            <div
              style={{
                width: '100%',
                height: '100%',
                backgroundImage: `url(${url})`,
                backgroundSize: 'cover',
                backgroundPosition: '50%',
              }}
            />
          ) : (
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none" style={{ flexShrink: 0 }}>
              <circle cx="20" cy="20" r="20" fill="#FFFFFF0A" />
              <path d="M20 12C16.69 12 14 14.69 14 18C14 20.48 15.43 22.63 17.5 23.65V26C17.5 26.55 17.95 27 18.5 27H21.5C22.05 27 22.5 26.55 22.5 26V23.65C24.57 22.63 26 20.48 26 18C26 14.69 23.31 12 20 12Z" fill="#FFFFFF26" />
            </svg>
          )}


          {/* top-right: batch checkbox or more menu */}
          {batchMode ? (
            <div style={{
              position: 'absolute', top: '8px', right: '8px',
              width: '18px', height: '18px', borderRadius: '4px',
              border: selected ? '1px solid #2DC3E1' : '1px solid rgba(255,255,255,0.5)',
              backgroundColor: selected ? '#2DC3E1' : 'rgba(0,0,0,0.5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {selected && (
                <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                  <path d="M1 4L3.5 6.5L9 1" stroke="#000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
          ) : hov && (
            <div
              style={{ position: 'absolute', top: '8px', right: '8px' }}
              onClick={(e) => e.stopPropagation()}
            >
              <MoreMenu onDownload={onDownload} onDelete={onDelete} />
            </div>
          )}

        </div>

        {/* info overlay */}
        <div style={{
          position: 'absolute', left: 0, bottom: 0, right: 0,
          backgroundColor: '#161616F2',
          padding: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
        }}>
          <span style={{ fontFamily: FONT_MEDIUM, fontWeight: 500, fontSize: '14px', lineHeight: '20px', color: '#FFFFFFE6', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {name}
          </span>
          {desc ? (
            <span style={{
              fontFamily: FONT, fontSize: '12px', lineHeight: '17px', color: '#FFFFFF66',
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
            }}>
              {desc}
            </span>
          ) : null}
        </div>
      </div>

      {/* 分镜图详情弹窗 */}
      {detailOpen && category === 'storyboard_img' && (
        <ShotDetailModal
          onClose={() => setDetailOpen(false)}
          onDownload={() => onDownload?.()}
          onDelete={() => { onDelete?.(); }}
          onShowToast={onShowToast}
          shotNumber={name}
          prompt={asset.prompt}
          model={asset.model}
          resolution={asset.resolution}
          generatedAt={asset.created_at}
          images={images.map(img => ({ ...img, src: img.fileUrl ?? img.url, finalized: img.is_primary }))}
          refImages={asset.refImages}
        />
      )}

      {/* 分镜视频详情弹窗 */}
      {detailOpen && category === 'storyboard_video' && (
        <ShotVideoDetailModal
          onClose={() => setDetailOpen(false)}
          onDownload={() => onDownload?.()}
          onDelete={() => { onDelete?.(); }}
          onShowToast={onShowToast}
          shotNumber={name}
          prompt={asset.prompt}
          model={asset.model}
          resolution={asset.resolution}
          ratio={asset.ratio}
          generatedAt={asset.created_at}
          videoSrc={asset.videoUrl}
          frames={images.map(img => ({ ...img, src: img.fileUrl ?? img.url, finalized: img.is_primary }))}
          refMode={asset.refMode}
          firstFrame={asset.firstFrame}
          lastFrame={asset.lastFrame}
          refImages={asset.refImages}
          refVideos={asset.refVideos}
        />
      )}

      {/* 主体资产多图聚合详情弹窗 */}
      {detailOpen && category !== 'storyboard_img' && category !== 'storyboard_video' && images.length > 0 && (
        <SubjectAssetDetailModal
          onClose={() => setDetailOpen(false)}
          name={name}
          description={desc}
          images={images}
          onShowToast={onShowToast}
          onDownload={(imageId, fileUrl) => {
            const img = images.find(i => i.id === imageId);
            if (img?.fileUrl || fileUrl) {
              const a = document.createElement('a');
              a.href = fileUrl || img.fileUrl;
              a.download = `${name}_${imageId}`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
            }
          }}
          onDeleteImage={(imageId) => {
            if (images.length === 1) {
              setDetailOpen(false);
              onDelete?.();
            } else {
              onDelete?.(imageId);
            }
          }}
        />
      )}

      {/* 兼容旧逻辑 */}
      {detailOpen && category !== 'storyboard_img' && category !== 'storyboard_video' && (!images || images.length === 0) && (
        <ImageDetailModal
          card={{
            imageUrl: asset.fileUrl || asset.url || url,
            prompt: asset.prompt,
            model: asset.model,
            ratio: asset.ratio,
            resolution: asset.resolution,
            refImages: asset.refImages,
            createdAt: asset.created_at,
          }}
          onClose={() => setDetailOpen(false)}
          onDelete={() => { setDetailOpen(false); onDelete?.(); }}
        />
      )}
    </>
  );
}
