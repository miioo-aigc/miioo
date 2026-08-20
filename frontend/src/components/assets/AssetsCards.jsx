import { useState, useRef, useEffect } from 'react';
import { apiGetAssetDetail, apiGetShotDetail, apiGetShotVideoDetail } from '../../api/assets';
import { apiGetCreationVideo } from '../../api/creation';
import { mergeCreationVideoDetail } from '../../utils/creationDetailAdapter';
import ImageDetailModal from '../ImageDetailModal';
import AssetsMoreMenu from './AssetsMoreMenu';
import AssetCardMedia from './AssetCardMedia';
import AssetCardCreativeDetail from './AssetCardCreativeDetail';
import ProjectAssetDetail from './ProjectAssetDetail';
import SubjectAssetDetailModal from './SubjectAssetDetailModal';
import AssetDetailModal from './AssetDetailModal';
import ShotDetailModal from './ShotDetailModal';
import ShotVideoDetailModal from './ShotVideoDetailModal';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif";
const FONT_MEDIUM = "'AlibabaPuHuiTi_2_65_Medium','Alibaba PuHuiTi 2.0',system-ui,sans-serif";

export function AssetCard({ name, url = null, starred = false, selected = false, batchMode = false, showStar = false, assetType = 'asset', videoObjectFit = 'cover', onDownload, onDelete, onStar, onSelect, asset = {} }) {
  const [hov, setHov] = useState(false);
  const [starAnim, setStarAnim] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailData, setDetailData] = useState(null);
  const [creativeDetailAsset, setCreativeDetailAsset] = useState(null);

  function handleOpen() {
    if (batchMode) { onSelect?.(); return; }
    // 创作视频列表是轻量摘要；打开后用详情接口补全参考素材。
    if (asset.type === 'image' || asset.type === 'video') {
      setCreativeDetailAsset(asset);
      setDetailOpen(true);
      if (asset.type === 'video' && asset.backendId) {
        const backendId = asset.backendId;
        apiGetCreationVideo(backendId)
          .then((detail) => {
            setCreativeDetailAsset((current) => current?.backendId === backendId
              ? mergeCreationVideoDetail(current, detail)
              : current);
          })
          .catch((error) => {
            console.warn('[AssetsCards] 创作视频详情加载失败，保留列表摘要展示', error);
          });
      }
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
      onClick={() => { if (batchMode) onSelect?.(); else handleOpen(); }}
    >
      <AssetCardMedia
        name={name}
        url={url}
        starred={starred}
        selected={selected}
        batchMode={batchMode}
        showStar={showStar}
        asset={asset}
        hovered={hov}
        starAnim={starAnim}
        onHoverChange={setHov}
        onStar={handleStar}
        onDownload={onDownload}
        onDelete={onDelete}
        videoObjectFit={videoObjectFit}
      />
    </div>
    {detailOpen && assetType === 'shot_video' && (
      <ShotVideoDetailModal onClose={() => setDetailOpen(false)} onDownload={onDownload} onDelete={() => { setDetailOpen(false); onDelete?.(); }}
        shotNumber={detailData?.shotNumber} prompt={detailData?.input_prompt ?? detailData?.prompt} model={detailData?.model}
        resolution={detailData?.resolution} duration={detailData?.duration} ratio={detailData?.ratio}
        generatedAt={detailData?.generatedAt} frames={detailData?.frames} videoSrc={detailData?.videoSrc}
        refMode={detailData?.refMode || detailData?.reference_mode} refModeLabel={detailData?.refModeLabel || detailData?.reference_mode_label} firstFrame={detailData?.firstFrame} lastFrame={detailData?.lastFrame}
        refImages={detailData?.refImages} refVideos={detailData?.refVideos}
      />
    )}
    {detailOpen && assetType === 'shot' && (
      <ShotDetailModal onClose={() => setDetailOpen(false)} onDownload={onDownload} onDelete={() => { setDetailOpen(false); onDelete?.(); }}
        shotNumber={detailData?.shotNumber} prompt={detailData?.input_prompt ?? detailData?.prompt} model={detailData?.model}
        resolution={detailData?.resolution} generatedAt={detailData?.generatedAt} images={detailData?.images}
        refImages={detailData?.refImages}
      />
    )}
    {detailOpen && creativeDetailAsset && (asset.type === 'image' || asset.type === 'video') && (
      <AssetCardCreativeDetail
        asset={creativeDetailAsset}
        url={url}
        starred={starred}
        onClose={() => { setDetailOpen(false); setCreativeDetailAsset(null); }}
        onDownload={onDownload}
        onDelete={() => { setDetailOpen(false); setCreativeDetailAsset(null); onDelete?.(); }}
        onFavorite={() => onStar?.()}
      />
    )}
    {detailOpen && assetType !== 'shot' && assetType !== 'shot_video' && !asset.type && showStar && (
      <ImageDetailModal
       card={{
         imageUrl: url || detailData?.url,
          prompt: detailData?.input_prompt ?? detailData?.prompt,
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
        name={detailData?.name ?? name} description={detailData?.description} prompt={detailData?.input_prompt ?? detailData?.prompt} model={detailData?.model}
        ratio={detailData?.ratio} resolution={detailData?.resolution} generatedAt={detailData?.generatedAt} images={detailData?.images}
      />
    )}
    </>
  );
}

export function ProjectAssetCard({ name, desc, url, selected, batchMode, onDownload, onDelete, onSelect, onShowToast, onOpenDetail, asset = {}, category = '' }) {
  const [hov, setHov] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);

  const images = asset.images ?? [];
  const isVideo = category === 'storyboard'
    ? asset.assetType === 'video'
    : category === 'storyboard_video';
  const videoRef = useRef(null);

  const isStoryboard = category === 'storyboard' || category === 'storyboard_img' || category === 'storyboard_video';
  const storyboardMediaFit = category === 'storyboard';
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
    if (onOpenDetail) { onOpenDetail(); return; }
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
          alignSelf: isStoryboard ? 'start' : undefined,
          minHeight: isStoryboard ? 0 : undefined,
        }}
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        onClick={handleClick}
      >
        {/* image/video area */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
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
              style={{ width: '100%', height: '100%', objectFit: storyboardMediaFit ? 'contain' : 'cover', display: 'block' }}
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
                backgroundSize: storyboardMediaFit ? 'contain' : 'cover',
                backgroundRepeat: storyboardMediaFit ? 'no-repeat' : undefined,
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
              <AssetsMoreMenu onDownload={onDownload} onDelete={onDelete} />
            </div>
          )}

        </div>

        {isStoryboard ? (
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
            {desc && category !== 'storyboard' ? (
              <span style={{
                fontFamily: FONT, fontSize: '12px', lineHeight: '17px', color: '#FFFFFF66',
                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
              }}>
                {desc}
              </span>
            ) : null}
          </div>
        ) : (
          <div style={{
            flexShrink: 0,
            backgroundColor: '#1A1A1A',
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}>
            <span style={{ fontFamily: FONT_MEDIUM, fontWeight: 500, fontSize: '14px', lineHeight: '20px', height: '20px', color: '#FFFFFFE6', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {name}
            </span>
            <span style={{
              fontFamily: FONT, fontSize: '12px', lineHeight: '17px', height: '34px', color: '#FFFFFF66',
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
            }}>
              {desc || ''}
            </span>
          </div>
        )}
      </div>

      <ProjectAssetDetail
        open={detailOpen}
        category={category}
        name={name}
        description={desc}
        url={url}
        asset={asset}
        images={images}
        onClose={() => setDetailOpen(false)}
        onDownload={(imageId) => {
          const image = images.find((item) => String(item.id) === String(imageId));
          onDownload?.(image?.id ?? imageId, name, image || asset);
        }}
        onDelete={onDelete}
        onShowToast={onShowToast}
        SubjectAssetDetailModal={SubjectAssetDetailModal}
        ShotDetailModal={ShotDetailModal}
        ShotVideoDetailModal={ShotVideoDetailModal}
      />
    </>
  );
}
