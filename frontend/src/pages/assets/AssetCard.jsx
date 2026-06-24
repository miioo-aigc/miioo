import { useState, useRef, useEffect } from 'react';
import MoreMenu from './MoreMenu';
import StarIcon from '../../components/StarIcon';
import ShotVideoDetailModal from './ShotVideoDetailModal';
import ShotDetailModal from './ShotDetailModal';
import AssetDetailModal from './AssetDetailModal';
import ImageDetailModal from '../../components/ImageDetailModal';
import CreationVideoDetailModal from '../../components/CreationVideoDetailModal';
import { apiGetAssetDetail, apiGetShotDetail, apiGetShotVideoDetail } from '../../api/assets';

export default function AssetCard({ name, bgColor = '#252525', url = null, starred = false, selected = false, batchMode = false, showStar = false, assetType = 'asset', onDownload, onDelete, onStar, onSelect, asset = {} }) {
  const [hov, setHov] = useState(false);
  const [starAnim, setStarAnim] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailData, setDetailData] = useState(null);
  const videoRef = useRef(null);

  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    if (hov) {
      vid.currentTime = 0;
      vid.play().catch(() => {});
    } else {
      vid.pause();
    }
  }, [hov]);

  function handleOpen() {
    if (batchMode) { onSelect?.(); return; }
    // 创作资产：直接用 card 数据打开详情弹窗，不调 API
    if (asset.type === 'image' || asset.type === 'video') {
      setDetailOpen(true);
      return;
    }
    const id = asset.id;
    if (assetType === 'shot_video') {
      apiGetShotVideoDetail(id).then((d) => { setDetailData(d); setDetailOpen(true); });
    } else if (assetType === 'shot') {
      apiGetShotDetail(id).then((d) => { setDetailData(d); setDetailOpen(true); });
    } else {
      apiGetAssetDetail(id).then((d) => { setDetailData(d); setDetailOpen(true); });
    }
  }

  function handleStar(e) {
    e.stopPropagation();
    setStarAnim(true);
    setTimeout(() => setStarAnim(false), 300);
    onStar?.();
  }

  return (
    <>
    <div
      style={{
        width: '100%',
        aspectRatio: '16/9',
        borderRadius: '10px',
        backgroundColor: '#1C1C1C',
        border: selected ? '1px solid #2DC3E1' : hov ? '1px solid #FFFFFF33' : '1px solid #FFFFFF0F',
        overflow: 'hidden',
        transition: 'border-color 0.15s',
        cursor: 'pointer',
        position: 'relative',
      }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onClick={() => { if (batchMode) onSelect?.(); else handleOpen(); }}
    >
      <div style={{ width: '100%', height: '100%', backgroundColor: hov ? '#343434' : '#272727', transition: 'background-color 0.15s', position: 'relative' }}>
        {asset.videoUrl ? (
          <video ref={videoRef} src={asset.videoUrl} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} muted playsInline loop preload="metadata" />
        ) : asset.type === 'video' && asset.videoUrl ? (
          <video src={asset.videoUrl} poster={url} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} muted playsInline preload="metadata" />
        ) : url ? (
          <img src={url} alt={name} style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
        ) : null}
        {batchMode ? (
          <div style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            width: '18px',
            height: '18px',
            borderRadius: '4px',
            border: selected ? '1px solid #2DC3E1' : '1px solid rgba(255,255,255,0.5)',
            backgroundColor: selected ? '#2DC3E1' : 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            {selected && (
              <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                <path d="M1 4L3.5 6.5L9 1" stroke="#000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>
        ) : hov && !showStar && (
          <div style={{ position: 'absolute', top: '8px', right: '8px' }}>
            <MoreMenu onDownload={onDownload} onDelete={onDelete} />
          </div>
        )}
        {showStar && !batchMode && (
          <div style={{ position: 'absolute', top: '8px', right: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ opacity: hov ? 1 : 0, transition: 'opacity 0.15s' }}>
              <MoreMenu onDownload={onDownload} onDelete={onDelete} />
            </div>
            <button
              type="button"
              aria-label="收藏"
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#00000080',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                flexShrink: 0,
                opacity: hov || starred ? 1 : 0,
                transform: starAnim ? 'scale(1.4)' : 'scale(1)',
                transition: 'transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.15s',
              }}
              onClick={handleStar}
            >
              <StarIcon filled={starred} />
            </button>
          </div>
        )}
      </div>
    </div>
    {detailOpen && assetType === 'shot_video' && (
      <ShotVideoDetailModal onClose={() => setDetailOpen(false)} onDownload={onDownload} onDelete={() => { setDetailOpen(false); onDelete?.(); }}
        shotNumber={detailData?.shotNumber} prompt={detailData?.prompt} model={detailData?.model}
        resolution={detailData?.resolution} duration={detailData?.duration} ratio={detailData?.ratio}
        generatedAt={detailData?.generatedAt} frames={detailData?.frames} videoSrc={detailData?.videoSrc}
        refMode={detailData?.refMode} firstFrame={detailData?.firstFrame} lastFrame={detailData?.lastFrame}
        sound={detailData?.sound} refImages={detailData?.refImages} refVideos={detailData?.refVideos}
      />
    )}
    {detailOpen && assetType === 'shot' && (
      <ShotDetailModal onClose={() => setDetailOpen(false)} onDownload={onDownload} onDelete={() => { setDetailOpen(false); onDelete?.(); }}
        shotNumber={detailData?.shotNumber} prompt={detailData?.prompt} model={detailData?.model}
        resolution={detailData?.resolution} generatedAt={detailData?.generatedAt} images={detailData?.images}
        refImages={detailData?.refImages}
      />
    )}
    {detailOpen && asset.type === 'video' && (
      <CreationVideoDetailModal
        videoUrl={asset.videoUrl}
        prompt={asset.prompt}
        model={asset.model}
        ratio={asset.ratio}
        resolution={asset.resolution}
        duration={asset.duration}
        refMode={asset.refMode}
        firstFrame={asset.firstFrame}
        lastFrame={asset.lastFrame}
        sound={asset.sound}
        createdAt={asset.createdAt}
        refImages={asset.refImages || []}
        onClose={() => setDetailOpen(false)}
        onDelete={() => { setDetailOpen(false); onDelete?.(); }}
        favorited={starred}
        onFavorite={() => onStar?.()}
      />
    )}
    {detailOpen && asset.type === 'image' && (
      <ImageDetailModal
        card={{
          imageUrl: asset.imageUrl || url,
          prompt: asset.prompt,
          model: asset.model,
          ratio: asset.ratio,
          resolution: asset.resolution,
          refImages: asset.refImages,
          createdAt: asset.createdAt,
        }}
        onClose={() => setDetailOpen(false)}
        onDelete={() => { setDetailOpen(false); onDelete?.(); }}
        favorited={starred}
        onToggleFavorite={() => onStar?.()}
      />
    )}
    {detailOpen && assetType !== 'shot' && assetType !== 'shot_video' && !asset.type && showStar && (
      <ImageDetailModal
        card={{
          imageUrl: url || detailData?.url,
          prompt: detailData?.prompt,
          model: detailData?.model,
          ratio: detailData?.ratio,
          resolution: detailData?.resolution,
          refImages: detailData?.refImages,
          generatedAt: detailData?.generatedAt,
        }}
        onClose={() => setDetailOpen(false)}
        onDelete={() => { setDetailOpen(false); onDelete?.(); }}
        favorited={starred}
        onToggleFavorite={() => onStar?.()}
      />
    )}
    {detailOpen && assetType !== 'shot' && assetType !== 'shot_video' && !showStar && (
      <AssetDetailModal onClose={() => setDetailOpen(false)} onDownload={onDownload}
        name={detailData?.name ?? name} description={detailData?.description} prompt={detailData?.prompt} model={detailData?.model}
        ratio={detailData?.ratio} resolution={detailData?.resolution} generatedAt={detailData?.generatedAt} images={detailData?.images}
      />
    )}
    </>
  );
}
