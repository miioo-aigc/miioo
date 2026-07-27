/**
 * Seedance 素材库素材预览弹窗。
 * 只负责展示素材，删除确认和接口请求由父面板编排。
 */

import { createPortal } from 'react-dom';
import { normalizeImageUrl } from '../../utils/imageUrl';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif";

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2.667 2.667L13.333 13.333M2.667 13.333L13.333 2.667" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function SeedanceAssetPreviewModal({ asset, onClose }) {
  if (!asset) return null;

  const assetType = String(asset.asset_type || '').toLowerCase();
  const isVideo = assetType === 'video';
  const isAudio = assetType === 'audio';
  const mediaUrl = isVideo
    ? (asset.source_url || asset.file_url || asset.preview_url)
    : (asset.preview_url || asset.asset_ref_url || asset.file_url);
  const posterUrl = asset.posterUrl || asset.poster_url || asset.thumbnail_url || asset.thumbnailUrl;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="查看素材"
      style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', background: '#00000099', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
      onClick={onClose}
    >
      <div
        style={{ width: 'min(960px, 90vw)', height: 'min(720px, 86vh)', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid #FFFFFF14', borderRadius: '16px', background: '#161616', boxShadow: '0 24px 64px #00000099' }}
        onClick={(event) => event.stopPropagation()}
      >
        <div style={{ height: '60px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', borderBottom: '1px solid #FFFFFF0F', fontFamily: FONT }}>
          <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#FFFFFF', fontSize: '16px', lineHeight: '20px' }}>
            {asset.name || '查看素材'}
          </span>
          <button type="button" aria-label="关闭" onClick={onClose} style={{ width: '28px', height: '28px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, border: 0, borderRadius: '6px', background: 'transparent', color: '#FFFFFF99', cursor: 'pointer' }}>
            <CloseIcon />
          </button>
        </div>
        <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', background: '#0A0A0A' }}>
          {isVideo && mediaUrl ? (
            <video src={normalizeImageUrl(mediaUrl)} poster={posterUrl ? normalizeImageUrl(posterUrl) : undefined} controls autoPlay muted playsInline style={{ maxWidth: '100%', maxHeight: '100%', display: 'block' }} />
          ) : isAudio && mediaUrl ? (
            <audio src={normalizeImageUrl(mediaUrl)} controls autoPlay style={{ width: 'min(560px, 100%)' }} />
          ) : mediaUrl ? (
            <img src={normalizeImageUrl(mediaUrl)} alt={asset.name || '素材预览'} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block' }} />
          ) : (
            <span style={{ fontFamily: FONT, color: '#FFFFFF66', fontSize: '14px' }}>暂无可预览内容</span>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
