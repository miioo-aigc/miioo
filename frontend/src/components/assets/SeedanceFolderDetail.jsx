/**
 * Seedance 素材库文件夹详情。
 * 负责图片/视频展示和上传入口，数据请求与页面状态由父面板编排。
 */

import { useEffect, useRef, useState } from 'react';
import { normalizeImageUrl } from '../../utils/imageUrl';
import { createVideoFirstFrame } from './seedanceUploadValidation';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif";

function UploadIcon() {
  return (
    <svg viewBox="0 0 102.4 102.4" xmlns="http://www.w3.org/2000/svg" width="20" height="20" aria-hidden="true">
      <path d="M79.997 76.8H22.397a3.2 3.2 0 0 1-3.2-3.2v-25.6a3.2 3.2 0 0 1 3.2-3.2h6.4a3.2 3.2 0 1 1 0 6.4H25.597v19.2h51.2v-19.2h-3.2a3.2 3.2 0 0 1 0-6.4h6.4a3.2 3.2 0 0 1 3.2 3.2v25.6a3.2 3.2 0 0 1-3.2 3.2z m-25.6-40.272v24.275a3.2 3.2 0 0 1-6.4 0v-24.288l-4.128 4.128a3.2 3.2 0 0 1-4.512-4.512l9.408-9.408a3.194 3.194 0 0 1 1.981-1.088 3.197 3.197 0 0 1 2.723 0.896l9.6 9.6A3.2 3.2 0 0 1 60.797 41.6a3.2 3.2 0 0 1-2.272-0.928L54.397 36.528z" fill="#FFFFFFCC" />
    </svg>
  );
}

function PreviewIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M6.667 2.667H3.333a.666.666 0 0 0-.666.666v3.334M9.333 13.333h3.334a.666.666 0 0 0 .666-.666V9.333M3 3l4 4M13 13l-4-4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9.333 2.667h3.334a.666.666 0 0 1 .666.666v3.334M6.667 13.333H3.333a.666.666 0 0 1-.666-.666V9.333M13 3 9 7M3 13l4-4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 3.333V14.667H13V3.333H3Z" stroke="currentColor" strokeLinejoin="round" />
      <path d="M6.667 6.667V11M9.333 6.667V11M1.333 3.333H14.667M5.333 3.333L6.43 1.333H9.592L10.667 3.333H5.333Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function AssetImageCard({ asset, onPreview, onDelete }) {
  const [generatedPoster, setGeneratedPoster] = useState(null);
  const [isHovered, setIsHovered] = useState(false);
  const videoRef = useRef(null);
  const rawAssetType = String(asset.asset_type || asset.assetType || asset.type || '').toLowerCase();
  const assetType = rawAssetType.startsWith('video/') ? 'video' : rawAssetType;
  const isVideo = assetType === 'video';
  const isAudio = assetType === 'audio';
  const imageUrl = isVideo
    ? (asset.posterUrl || asset.poster_url || asset.thumbnailUrl || asset.thumbnail_url || null)
    : (asset.preview_url || asset.previewUrl || asset.asset_ref_url || asset.assetRefUrl);
  const videoUrl = isVideo ? (asset.source_url || asset.sourceUrl || asset.file_url || asset.fileUrl || asset.preview_url || asset.previewUrl || null) : null;

  useEffect(() => {
    if (!isVideo || imageUrl || !videoUrl || asset.localFile) return undefined;
    let cancelled = false;
    fetch(videoUrl, { mode: 'cors' })
      .then((response) => response.blob())
      .then((blob) => createVideoFirstFrame(new File([blob], asset.name || 'video.mp4', { type: blob.type || 'video/mp4' })))
      .then((poster) => { if (!cancelled) setGeneratedPoster(poster); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [asset.localFile, asset.name, imageUrl, isVideo, videoUrl]);

  const posterUrl = imageUrl || generatedPoster;
  const canPreview = Boolean(imageUrl || videoUrl || isAudio);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isVideo || !videoUrl) return undefined;
    if (isHovered) {
      video.currentTime = 0;
      video.play().catch(() => {});
    } else {
      video.pause();
      video.currentTime = 0;
    }
    return undefined;
  }, [isHovered, isVideo, videoUrl]);
  return (
    <div
      style={{
        width: '242px',
        height: '160px',
        borderRadius: '8px',
        flexShrink: 0,
        position: 'relative',
        overflow: 'hidden',
        cursor: imageUrl || videoUrl || isAudio ? 'pointer' : 'default',
        boxSizing: 'border-box',
        background: '#1A1A1A',
      }}
      title={asset.name || undefined}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {isVideo && videoUrl ? (
        <video
          ref={videoRef}
          src={normalizeImageUrl(videoUrl)}
          poster={posterUrl ? (posterUrl.startsWith('data:') ? posterUrl : normalizeImageUrl(posterUrl)) : undefined}
          muted
          playsInline
          preload="metadata"
          aria-label={asset.name || '视频素材'}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', background: '#1A1A1A', pointerEvents: 'none' }}
        />
      ) : isAudio ? (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', background: '#1A1A1A' }}>
          <audio src={normalizeImageUrl(asset.source_url || asset.preview_url)} controls preload="metadata" aria-label={asset.name || '音频素材'} style={{ width: '100%' }} />
        </div>
      ) : imageUrl ? (
        <div
          role="img"
          aria-label={asset.name || '图片素材'}
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `url(${normalizeImageUrl(imageUrl)})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
      ) : null}
      {isHovered ? (
        <div
          style={{ position: 'absolute', right: '12px', bottom: '12px', zIndex: 3, display: 'flex', alignItems: 'center', gap: '6px' }}
          onClick={(event) => event.stopPropagation()}
        >
          {canPreview ? (
            <button
              type="button"
              aria-label={`放大查看${asset.name ? ` ${asset.name}` : ''}`}
              onClick={(event) => { event.stopPropagation(); onPreview?.(asset); }}
              style={{ width: '24px', height: '24px', padding: 0, border: 0, borderRadius: '6px', background: '#00000099', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'background 0.12s' }}
              onMouseEnter={(event) => { event.currentTarget.style.background = '#2A2A2A99'; }}
              onMouseLeave={(event) => { event.currentTarget.style.background = '#00000099'; }}
            >
              <PreviewIcon />
            </button>
          ) : null}
          <button
            type="button"
            aria-label={`删除${asset.name ? ` ${asset.name}` : ''}`}
            onClick={(event) => { event.stopPropagation(); onDelete?.(asset); }}
            style={{ width: '24px', height: '24px', padding: 0, border: 0, borderRadius: '6px', background: '#00000099', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'color 0.12s, background 0.12s' }}
            onMouseEnter={(event) => { event.currentTarget.style.background = '#2A2A2A99'; event.currentTarget.style.color = '#FF4444'; }}
            onMouseLeave={(event) => { event.currentTarget.style.background = '#00000099'; event.currentTarget.style.color = '#FFFFFF'; }}
          >
            <DeleteIcon />
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default function SeedanceFolderDetail({ folder, assets = [], loading = false, uploading = false, onBack, onUpload, onPreview, onDelete }) {
  const inputRef = useRef(null);

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) onUpload?.(file);
  };

  return (
    <div
      style={{
        flex: '1 1 0%',
        minHeight: 0,
        overflow: 'auto',
        padding: '0 24px 8px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        fontFamily: FONT,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', flexShrink: 0 }}>
        <button
          type="button"
          onClick={onBack}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: '#FFFFFF66' }}
        >
          返回/
        </button>
        <span style={{ fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: '#FFFFFF' }}>{folder.name}</span>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignContent: 'flex-start' }}>
        <input
          ref={inputRef}
          accept=".jpeg,.jpg,.png,.webp,.gif,.heic,.mp4,.mov,.mp3,.wav,image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,audio/mpeg,audio/wav"
          type="file"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
        <button
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          style={{ width: '242px', height: '160px', borderRadius: '8px', border: '1px dashed rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.03)', cursor: uploading ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', flexShrink: 0, transition: 'background 0.15s', opacity: uploading ? 0.65 : 1, fontFamily: FONT }}
          onMouseEnter={(event) => { if (!uploading) event.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
          onMouseLeave={(event) => { event.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
        >
          <UploadIcon />
          <span style={{ fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: '#FFFFFFCC', flexShrink: 0 }}>{uploading ? '上传中...' : '上传'}</span>
        </button>
        {loading ? <span style={{ alignSelf: 'center', fontFamily: FONT, fontSize: '13px', lineHeight: '18px', color: '#FFFFFF66' }}>加载中...</span> : null}
        {!loading && assets.map((asset) => <AssetImageCard key={asset.id} asset={asset} onPreview={onPreview} onDelete={onDelete} />)}
      </div>
    </div>
  );
}
