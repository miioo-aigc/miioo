/**
 * Seedance 素材卡片。
 * 统一资产库文件夹详情页和资产选择弹窗的媒体展示；选择逻辑由调用方传入。
 */

import { memo, useEffect, useRef, useState } from 'react';
import { normalizeImageUrl } from '../../utils/imageUrl';
import { createVideoFirstFrame } from './SeedanceUploadValidation';
import DotsLoading from '../DotsLoading';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif";

function getReviewState(asset) {
  const status = String(asset?.status || '').trim().toLowerCase();
  if (['active', 'approved', 'success', 'succeeded', 'completed', 'complete', 'ready', 'done'].includes(status)) return 'approved';
  if (['failed', 'rejected', 'reject', 'invalid', 'error'].includes(status)) return 'rejected';
  return 'pending';
}

function getAssetType(asset) {
  const type = String(asset?.asset_type || asset?.assetType || asset?.type || 'image').toLowerCase();
  return type.startsWith('video/') ? 'video' : type;
}

function cleanMediaUrl(value) {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  const markdownMatch = trimmed.match(/^\[[^\]]*\]\(\s*(https?:\/\/[^)\s]+)\s*\)$/i);
  const url = markdownMatch ? markdownMatch[1] : trimmed;
  if (!/^https?:\/\//i.test(url) && !/^blob:/i.test(url) && !/^data:/i.test(url) && !url.startsWith('/')) return null;
  // 部分接口日志/序列化结果会把 URL 中的符号保留成转义形式，交给浏览器前先还原。
  return url.replace(/\\&/g, '&').replace(/\\_/g, '_');
}

function getImageUrls(asset) {
  return [
    asset?.url,
    asset?.preview_url,
    asset?.previewUrl,
    asset?.posterUrl,
    asset?.poster_url,
    asset?.thumbnailUrl,
    asset?.thumbnail_url,
    asset?.source_url,
    asset?.sourceUrl,
    asset?.file_url,
    asset?.fileUrl,
  ].map(cleanMediaUrl).filter(Boolean).filter((url, index, list) => list.indexOf(url) === index);
}

function getVideoUrls(asset) {
  return [
    asset?.url,
    asset?.fullUrl,
    asset?.source_url,
    asset?.sourceUrl,
    asset?.file_url,
    asset?.fileUrl,
    asset?.preview_url,
    asset?.previewUrl,
  ].map(cleanMediaUrl).filter(Boolean).filter((url, index, list) => list.indexOf(url) === index);
}

/*
 * preview_url 可能是短时签名地址，失败时必须继续尝试 source_url，
 * 否则一个失效的预览地址会把整个素材永久显示成黑卡片。
 */
function getFallbackUrl(urls, failedUrls) {
  return urls.find((url) => !failedUrls.has(url)) || null;
}

function PreviewIcon() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M6.667 2.667H3.333a.666.666 0 0 0-.666.666v3.334M9.333 13.333h3.334a.666.666 0 0 0 .666-.666V9.333M3 3l4 4M13 13l-4-4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" /><path d="M9.333 2.667h3.334a.666.666 0 0 1 .666.666v3.334M6.667 13.333H3.333a.666.666 0 0 1-.666-.666V9.333M13 3 9 7M3 13l4-4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function DeleteIcon() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 3.333V14.667H13V3.333H3Z" stroke="currentColor" strokeLinejoin="round" /><path d="M6.667 6.667V11M9.333 6.667V11M1.333 3.333H14.667M5.333 3.333L6.43 1.333H9.592L10.667 3.333H5.333Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

const SeedanceAssetCard = memo(function SeedanceAssetCard({
  asset,
  onPreview,
  onDelete,
  onClick,
  selected = false,
  disabled = false,
  showActions = true,
  showSelection = false,
  width = '242px',
}) {
  const [generatedPoster, setGeneratedPoster] = useState(null);
  const [isHovered, setIsHovered] = useState(false);
  const [failedMediaUrls, setFailedMediaUrls] = useState(() => new Set());
  const videoRef = useRef(null);
  const assetType = getAssetType(asset);
  const isVideo = assetType === 'video';
  const isAudio = assetType === 'audio';
  const imageUrls = getImageUrls(asset);
  const videoUrls = isVideo ? getVideoUrls(asset) : [];
  const imageUrl = getFallbackUrl(imageUrls, failedMediaUrls);
  const videoUrl = getFallbackUrl(videoUrls, failedMediaUrls);
  const normalizedImageUrl = imageUrl ? normalizeImageUrl(imageUrl) : null;
  const normalizedVideoUrl = videoUrl ? normalizeImageUrl(videoUrl) : null;
  const posterUrl = generatedPoster || normalizedImageUrl;
  const reviewState = getReviewState(asset);
  const isUploading = asset.uploadState === 'uploading';
  const canPreview = Boolean(imageUrl || videoUrl || isAudio);

  useEffect(() => {
    if (!isVideo || imageUrl || !videoUrl || asset.localFile) return undefined;
    let cancelled = false;
    fetch(normalizedVideoUrl, { mode: 'cors' })
      .then((response) => response.blob())
      .then((blob) => createVideoFirstFrame(new File([blob], asset.name || 'video.mp4', { type: blob.type || 'video/mp4' })))
      .then((poster) => { if (!cancelled) setGeneratedPoster(poster); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [asset.localFile, asset.name, imageUrl, isVideo, normalizedVideoUrl, videoUrl]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isVideo || !normalizedVideoUrl) return undefined;
    if (isHovered) {
      video.currentTime = 0;
      video.play().catch(() => {});
    } else {
      video.pause();
      video.currentTime = 0;
    }
    return undefined;
  }, [isHovered, isVideo, normalizedVideoUrl]);

  const handleClick = () => {
    if (!disabled) onClick?.(asset);
  };

  const handleImageError = () => {
    if (!imageUrl) return;
    setFailedMediaUrls((current) => {
      if (current.has(imageUrl)) return current;
      return new Set([...current, imageUrl]);
    });
  };

  return (
    <div
      style={{ width, height: '160px', maxWidth: '100%', flex: width === '100%' ? '1 1 auto' : `0 0 ${width}`, minWidth: 0, borderRadius: '8px', position: 'relative', overflow: 'hidden', cursor: disabled ? 'not-allowed' : canPreview || onClick ? 'pointer' : 'default', boxSizing: 'border-box', background: '#1A1A1A', opacity: disabled ? 0.6 : 1 }}
      title={asset.name || undefined}
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {isVideo && normalizedVideoUrl ? (
        <video ref={videoRef} src={normalizedVideoUrl} poster={posterUrl || undefined} muted playsInline preload="auto" aria-label={asset.name || '视频素材'} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', background: '#1A1A1A', pointerEvents: 'none' }} />
      ) : isAudio ? (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', background: '#1A1A1A' }}><audio src={normalizeImageUrl(asset.source_url || asset.preview_url)} controls preload="metadata" aria-label={asset.name || '音频素材'} style={{ width: '100%' }} /></div>
      ) : normalizedImageUrl ? (
        <img key={normalizedImageUrl} src={normalizedImageUrl} alt={asset.name || '图片素材'} onError={handleImageError} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      ) : null}

      {isUploading || reviewState !== 'approved' ? (
        <div style={{ position: 'absolute', inset: 0, zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#00000099', pointerEvents: 'none' }}>
          {isUploading ? <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}><DotsLoading size={4} color="#2DC3E1" gap={3} /><span style={{ fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: '#FFFFFF' }}>上传中，请勿离开</span></div> : reviewState === 'rejected' ? <span style={{ fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: '#FFFFFF' }}>审核未通过</span> : <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}><DotsLoading size={4} color="#2DC3E1" gap={3} /><span style={{ fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: '#FFFFFF' }}>审核中</span></div>}
        </div>
      ) : null}

      {showSelection ? <div style={{ position: 'absolute', top: '8px', left: '8px', zIndex: 3, width: '18px', height: '18px', borderRadius: '4px', border: selected ? '1px solid #2DC3E1' : '1px solid rgba(255,255,255,0.5)', background: selected ? '#2DC3E1' : 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{selected ? <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="#000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg> : null}</div> : null}

      {showActions && isHovered ? <div style={{ position: 'absolute', right: '12px', bottom: '12px', zIndex: 3, display: 'flex', alignItems: 'center', gap: '6px' }} onClick={(event) => event.stopPropagation()}>
        {canPreview && reviewState === 'approved' ? <button type="button" aria-label={`放大查看${asset.name ? ` ${asset.name}` : ''}`} onClick={() => onPreview?.(asset)} style={{ width: '24px', height: '24px', padding: 0, border: 0, borderRadius: '6px', background: '#00000099', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><PreviewIcon /></button> : null}
        <button type="button" aria-label={`删除${asset.name ? ` ${asset.name}` : ''}`} onClick={() => onDelete?.(asset)} style={{ width: '24px', height: '24px', padding: 0, border: 0, borderRadius: '6px', background: '#00000099', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><DeleteIcon /></button>
      </div> : null}
    </div>
  );
});

export default SeedanceAssetCard;
