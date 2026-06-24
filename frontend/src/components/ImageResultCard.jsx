import { useState, useEffect, memo } from 'react';
import { FONT } from '../utils/fonts';
import StarIcon from './StarIcon';
import CardActionBtn from './CardActionBtn';
import ConfirmDialog from './ConfirmDialog';
import ImageDetailModal from './ImageDetailModal';
import downloadImage from '../utils/downloadImage';

const SHIMMER_STYLE_ID = 'creation-shimmer-style';

function ensureShimmerStyle() {
  if (document.getElementById(SHIMMER_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = SHIMMER_STYLE_ID;
  style.textContent = `
    .creation-shimmer {
      background: linear-gradient(90deg, #FFFFFF08 25%, #FFFFFF14 50%, #FFFFFF08 75%);
      background-size: 800px 100%;
      animation: creation-shimmer 1.6s ease-in-out infinite;
    }
  `;
  document.head.appendChild(style);
}

function ImageResultCard({ status, imageUrl, originalUrl, prompt, promptHTML, model, ratio, resolution, refImages, createdAt, onReEdit, onUseAsRef, onDelete, onSave, batchMode = false, isSelected = false, onToggleSelect, favorited = false, onToggleFavorite }) {
  const displayUrl = imageUrl;
  const downloadUrl = originalUrl || imageUrl;
  const [hovered, setHovered] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [starAnim, setStarAnim] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  useEffect(() => { ensureShimmerStyle(); }, []);

  function handleStarClick(e) {
    e.stopPropagation();
    setStarAnim(true);
    setTimeout(() => setStarAnim(false), 300);
    onToggleFavorite?.();
  }

  return (
    <>
      <div
        style={{
          width: '100%', aspectRatio: '16/9', borderRadius: '8px', overflow: 'hidden',
          backgroundColor: hovered ? '#343434' : '#272727', transition: 'background-color 0.15s',
          position: 'relative', cursor: 'pointer',
          outline: isSelected ? '2px solid #2DC3E1' : 'none', outlineOffset: '-2px',
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={() => {
          if (batchMode) { onToggleSelect?.(); return; }
          if (status !== 'done' || !imageUrl) return;
          setDetailOpen(true);
        }}
      >
        {status === 'loading' ? (
          <div className="creation-shimmer" style={{ width: '100%', height: '100%' }} />
        ) : imageUrl ? (
          <img src={displayUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#FFFFFF33', fontSize: '12px', fontFamily: FONT }}>生成失败</span>
          </div>
        )}

        {batchMode && imageUrl && (
          <div style={{ position: 'absolute', top: '8px', right: '8px', width: '18px', height: '18px', borderRadius: '4px', zIndex: 1, border: isSelected ? '1px solid #2DC3E1' : '1px solid rgba(255,255,255,0.5)', backgroundColor: isSelected ? '#2DC3E1' : 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {isSelected && (<svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="#000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>)}
          </div>
        )}

        {hovered && imageUrl && !batchMode && (
          <>
            <button type="button" onClick={handleStarClick}
              style={{ position: 'absolute', top: '8px', right: '8px', width: '24px', height: '24px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#00000080', border: 'none', cursor: 'pointer', transform: starAnim ? 'scale(1.4)' : 'scale(1)', transition: 'transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
              <StarIcon filled={favorited} />
            </button>
            <div style={{ position: 'absolute', bottom: '8px', right: '8px', display: 'flex', gap: '4px' }} onClick={(e) => e.stopPropagation()}>
              <CardActionBtn tooltip="重新编辑" onClick={() => onReEdit?.()}
                icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2.333 14H14.333" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" /><path d="M3.667 8.907V11.333H6.106L13 4.436L10.565 2L3.667 8.907Z" stroke="#FFFFFF" strokeLinejoin="round" /></svg>} />
              <CardActionBtn tooltip="用作参考图" onClick={() => onUseAsRef?.()}
                icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M12.667 7V13.333C12.667 13.702 12.368 14 12 14H2.667C2.298 14 2 13.702 2 13.333V4C2 3.632 2.298 3.333 2.667 3.333H8.788" stroke="#FFFFFF" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M4 10.344L6 7.667L7 8.667L8.167 6.833L10.667 10.344H4Z" stroke="#FFFFFF" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M11.334 3.333H14.001" stroke="#FFFFFF" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M12.664 1.932V4.598" stroke="#FFFFFF" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round" />
                </svg>} />
              <CardActionBtn tooltip="保存" onClick={() => downloadImage(downloadUrl)}
                icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8.003 11.3V2" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" /><path d="M4 7.333L8 11.333L12 7.333" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" /><path d="M4 14H12" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" /></svg>} />
              <CardActionBtn tooltip="删除" onClick={() => setConfirmDelete(true)}
                icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 3.333V14.667H13V3.333H3Z" stroke="#FFFFFF" strokeLinejoin="round" /><path d="M6.667 6.667V11" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" /><path d="M9.333 6.667V11" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" /><path d="M1.333 3.333H14.667" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" /><path d="M5.333 3.333L6.43 1.333H9.592L10.667 3.333H5.333Z" stroke="#FFFFFF" strokeLinejoin="round" /></svg>} />
            </div>
          </>
        )}
      </div>

      {detailOpen && (
        <ImageDetailModal
          card={{ imageUrl: downloadUrl, prompt, promptHTML, model, ratio, resolution, refImages, createdAt }}
          onClose={() => setDetailOpen(false)} onDelete={() => { setDetailOpen(false); onDelete?.(); }}
          favorited={favorited} onToggleFavorite={onToggleFavorite}
        />
      )}

      {confirmDelete && (
        <ConfirmDialog title="确认删除" description="删除后无法恢复，确定要删除这张图片吗？" confirmText="删除"
          onConfirm={() => { setConfirmDelete(false); onDelete?.(); }} onCancel={() => setConfirmDelete(false)} zIndex={1100} />
      )}
    </>
  );
}

export default memo(ImageResultCard);
