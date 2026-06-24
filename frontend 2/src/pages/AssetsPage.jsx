import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useModalSize } from '../utils/useModalSize';
import placeholderFlowers from '../assets/placeholder-flowers.webp';
import { apiGetAssetDetail, apiGetShotDetail, apiGetShotVideoDetail, apiGetProjectAssets, apiGetProjectAssetsPage, groupByCategory, calcProjectAssetsLimit, apiDeleteAsset, apiBatchDeleteAssets, apiUpdateAsset, apiDownloadAsset } from '../api/assets';
import { apiGetSubjects, apiDeleteSubject } from '../api/subject';
import { apiDeleteCreationImage, apiDeleteCreationVideo, apiBatchDeleteImages, apiBatchDeleteVideos, apiToggleImageFavorite, apiToggleVideoFavorite, apiListCreationImages, apiListCreationVideos, apiListCreationAudios } from '../api/creation';
import { useCreationStore } from '../stores/creationStore';
import { generationsToDays } from '../utils/creativeDaysAdapter';
import { apiGetProjects, apiDeleteProject, apiUpdateProject, apiDownloadProjectAssets } from '../api/project';
import { invalidate } from '../utils/cache';
import { K } from '../utils/cacheKeys';
import ImageDetailModal from '../components/ImageDetailModal';
import CreationVideoDetailModal from '../components/CreationVideoDetailModal';
import ConfirmDialog from '../components/ConfirmDialog';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif";
const FONT_MEDIUM = "'AlibabaPuHuiTi_2_65_Medium','Alibaba PuHuiTi 2.0',system-ui,sans-serif";

function DownloadIcon({ color = 'currentColor' }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <path d="M2.667 11.333V13.333H13.333V11.333" stroke={color} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 2.667V10.667" stroke={color} strokeLinecap="round" />
      <path d="M5 7.667L8 10.667L11 7.667" stroke={color} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TrashIcon({ color = 'currentColor' }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <path d="M3 3.333V14.667H13V3.333H3Z" stroke={color} strokeLinejoin="round" />
      <path d="M6.667 6.667V11" stroke={color} strokeLinecap="round" />
      <path d="M9.333 6.667V11" stroke={color} strokeLinecap="round" />
      <path d="M1.333 3.333H14.667" stroke={color} strokeLinecap="round" />
      <path d="M5.333 3.333L6.43 1.333H9.592L10.667 3.333H5.333Z" stroke={color} strokeLinejoin="round" />
    </svg>
  );
}

function StarIcon({ filled = false }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
      <path
        d="M7 1.5l1.545 3.13 3.455.503-2.5 2.436.59 3.44L7 9.369l-3.09 1.64.59-3.44L2 5.133l3.455-.503L7 1.5z"
        fill={filled ? '#F0B429' : 'none'}
        stroke={filled ? '#F0B429' : 'rgba(255,255,255,0.6)'}
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// GhostButton — matches design system ghost button style
function GhostButton({ children, onClick, danger }) {
  const [hov, setHov] = useState(false);
  const [pressed, setPressed] = useState(false);
  return (
    <button
      type="button"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '36px',
        flexShrink: 0,
        borderRadius: '8px',
        padding: '1px',
        boxShadow: '#00000066 3px 3px 8px',
        backgroundImage: 'linear-gradient(in oklab 148.76deg, oklab(94.7% -0.078 -0.022 / 30%) 3.64%, oklab(75.5% -0.102 -0.072 / 0%) 42.81%), linear-gradient(in oklab 180deg, #FFFFFF14, #FFFFFF14)',
        outline: '1px solid #00000080',
        border: 'none',
        cursor: 'pointer',
      }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => { setHov(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onClick={onClick}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          flexGrow: 1,
          flexShrink: 1,
          flexBasis: '0%',
          borderRadius: '7px',
          padding: '0 15px',
          gap: '4px',
          backgroundColor: pressed ? '#252525' : hov ? '#1D1E1E' : '#161616',
          transition: 'background-color 0.12s',
        }}
      >
        {children}
      </div>
    </button>
  );
}

function GhostBtn({ children, onClick }) {
  const [hov, setHov] = useState(false);
  const [pressed, setPressed] = useState(false);
  return (
    <div
      role="button"
      tabIndex={0}
      style={{ display: 'flex', flexDirection: 'column', height: '36px', flexShrink: 0, borderRadius: '8px', padding: '1px', boxShadow: '#00000066 3px 3px 8px', backgroundImage: 'linear-gradient(in oklab 148.76deg, oklab(94.7% -0.078 -0.022 / 30%) 3.64%, oklab(75.5% -0.102 -0.072 / 0%) 42.81%), linear-gradient(in oklab 180deg, #FFFFFF14, #FFFFFF14)', outline: '1px solid #00000080', border: 'none', cursor: 'pointer', opacity: pressed ? 0.75 : 1, transition: 'opacity 0.1s' }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => { setHov(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onClick={onClick}
    >
      <div style={{ display: 'flex', alignItems: 'center', flexGrow: 1, flexShrink: 1, flexBasis: '0%', borderRadius: '7px', paddingLeft: '15px', paddingRight: '15px', gap: '4px', backgroundColor: pressed ? '#252525' : hov ? '#1D1E1E' : '#161616', transition: 'background-color 0.12s' }}>
        {children}
      </div>
    </div>
  );
}

function PlainBtn({ children, onClick, danger }) {
  const [hov, setHov] = useState(false);
  const [pressed, setPressed] = useState(false);
  return (
    <div
      role="button"
      tabIndex={0}
      style={{ display: 'flex', alignItems: 'center', height: '36px', flexShrink: 0, borderRadius: '8px', paddingLeft: '16px', paddingRight: '16px', gap: '4px', boxShadow: '#00000066 3px 3px 8px', backgroundColor: pressed ? '#252525' : hov ? '#1D1E1E' : '#161616', border: '1px solid #FFFFFF0D', outline: '1px solid #00000080', cursor: 'pointer', transition: 'background-color 0.12s', opacity: pressed ? 0.8 : 1 }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => { setHov(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

// DeleteConfirmModal 已迁移至 ConfirmDialog 共享组件

function MoreMenu({ onDownload, onDelete }) {
  const [open, setOpen] = useState(false);
  const [hovIdx, setHovIdx] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const items = [
    { label: '下载', icon: <DownloadIcon />, action: () => { onDownload?.(); setOpen(false); }, danger: false },
    { label: '删除', icon: <TrashIcon />, action: () => { setOpen(false); setShowConfirm(true); }, danger: true },
  ];

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        style={{
          width: '24px',
          height: '24px',
          borderRadius: '6px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: open ? 'rgba(0,0,0,0.75)' : '#00000080',
          border: 'none',
          cursor: 'pointer',
          transition: 'background-color 0.12s',
          flexShrink: 0,
        }}
        onMouseEnter={(e) => { if (!open) e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.65)'; }}
        onMouseLeave={(e) => { if (!open) e.currentTarget.style.backgroundColor = '#00000080'; }}
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        aria-label="更多操作"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
          <circle cx="8" cy="4" r="1" fill="#fff" />
          <circle cx="8" cy="8" r="1" fill="#fff" />
          <circle cx="8" cy="12" r="1" fill="#fff" />
        </svg>
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            right: 0,
            zIndex: 50,
            minWidth: '100px',
            padding: '4px',
            borderRadius: '8px',
            backgroundColor: '#1C1C1C',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0px 4px 16px rgba(0,0,0,0.5)',
          }}
        >
          {items.map((item, i) => (
            <button
              key={item.label}
              type="button"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                width: '100%',
                padding: '8px 10px',
                borderRadius: '6px',
                border: 'none',
                background: hovIdx === i ? 'rgba(255,255,255,0.08)' : 'transparent',
                cursor: 'pointer',
                fontFamily: FONT,
                fontSize: '14px',
                lineHeight: '18px',
                color: item.danger ? '#FF6B6B' : 'rgba(255,255,255,0.8)',
                transition: 'background 0.1s',
              }}
              onMouseEnter={() => setHovIdx(i)}
              onMouseLeave={() => setHovIdx(null)}
              onClick={(e) => { e.stopPropagation(); item.action(); }}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      )}

      {showConfirm && (
        <ConfirmDialog
          title="确定要删除吗？"
          description="删除后，该资产将被清除且不可恢复。"
          confirmText="删除"
          onCancel={() => setShowConfirm(false)}
          onConfirm={() => { setShowConfirm(false); onDelete?.(); }}
          zIndex={100}
        />
      )}
    </div>
  );
}

function WaveformBars({ playing }) {
  const bars = [3, 6, 10, 7, 14, 9, 5, 12, 8, 4, 11, 7, 6, 13, 9, 5, 10, 7, 4, 8, 12, 6, 9, 5, 11, 7, 3, 10, 8, 6];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '2px', height: '24px' }}>
      {bars.map((h, i) => (
        <div
          key={i}
          style={{
            width: '2px',
            height: `${h}px`,
            borderRadius: '1px',
            backgroundColor: playing ? '#2DC3E1' : '#FFFFFF33',
            transition: 'background-color 0.2s',
            flexShrink: 0,
          }}
        />
      ))}
    </div>
  );
}

function AudioCard({ name, duration = '0:00', starred = false, selected = false, batchMode = false, onDownload, onDelete, onStar, onSelect }) {
  const [hov, setHov] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [starAnim, setStarAnim] = useState(false);

  function handleStar(e) {
    e.stopPropagation();
    setStarAnim(true);
    setTimeout(() => setStarAnim(false), 300);
    onStar?.();
  }

  function handlePlay(e) {
    e.stopPropagation();
    setPlaying((p) => !p);
  }

  return (
    <div
      style={{
        width: '100%',
        borderRadius: '10px',
        backgroundColor: '#1C1C1C',
        border: selected ? '1px solid #2DC3E1' : hov ? '1px solid #FFFFFF33' : '1px solid #FFFFFF0F',
        overflow: 'hidden',
        flexShrink: 0,
        transition: 'border-color 0.15s',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        paddingTop: '14px',
        paddingBottom: '14px',
        paddingLeft: '16px',
        paddingRight: '16px',
      }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onClick={() => { if (batchMode) onSelect?.(); }}
    >
      {batchMode ? (
        <div style={{
          width: '18px',
          height: '18px',
          borderRadius: '4px',
          border: selected ? '1px solid #2DC3E1' : '1px solid rgba(255,255,255,0.5)',
          backgroundColor: selected ? '#2DC3E1' : 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          {selected && (
            <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
              <path d="M1 4L3.5 6.5L9 1" stroke="#000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
      ) : (
        <button
          type="button"
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            backgroundColor: playing ? '#2DC3E1' : '#FFFFFF14',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            transition: 'background-color 0.15s',
          }}
          onClick={handlePlay}
        >
          {playing ? (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <rect x="2" y="1.5" width="3" height="9" rx="1" fill={playing ? '#000' : '#FFF'} />
              <rect x="7" y="1.5" width="3" height="9" rx="1" fill={playing ? '#000' : '#FFF'} />
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M3 2L10 6L3 10V2Z" fill="#FFFFFF" />
            </svg>
          )}
        </button>
      )}

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
        <span style={{
          fontFamily: FONT,
          fontSize: '14px',
          color: '#FFFFFF',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>{name}</span>
        <WaveformBars playing={playing} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
        <span style={{ fontFamily: FONT, fontSize: '12px', color: '#FFFFFF66', letterSpacing: '0.02em' }}>{duration}</span>
        {!batchMode && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', opacity: hov ? 1 : 0, transition: 'opacity 0.15s' }}>
            <button
              type="button"
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '6px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
                transform: starAnim ? 'scale(1.4)' : 'scale(1)',
                transition: 'transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1)',
              }}
              onClick={handleStar}
            >
              <StarIcon filled={starred} />
            </button>
            <button
              type="button"
              style={{ width: '28px', height: '28px', borderRadius: '6px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
              onClick={(e) => { e.stopPropagation(); onDownload?.(); }}
            >
              <DownloadIcon color="#FFFFFF99" />
            </button>
            <button
              type="button"
              style={{ width: '28px', height: '28px', borderRadius: '6px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
              onClick={(e) => { e.stopPropagation(); onDelete?.(); }}
            >
              <TrashIcon color="#FFFFFF66" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const MOCK_DETAIL = {
  name: '小虎',
  description: '一只雄性成年孟加拉虎，大型健壮体型，肩背宽厚，四肢粗壮，橘黄色短毛，黑色条纹较粗且分布稳定，右眼上方有一道浅色旧疤，颈部一圈深棕色较长鬃毛，头部较大，口鼻宽，尾巴中等长度，站姿平稳。',
  prompt: 'A lone detective walks through a rain-soaked alley at night, neon reflections shimmering on wet cobblestones, cinematic wide shot, shallow depth of field, moody noir atmosphere',
  model: 'Kling 2.1 Pro',
  ratio: '16:9',
  resolution: '1920 × 1080',
  generatedAt: '2026-04-21 15:30:09',
  // index 0 is the finalized image
  images: [
    { id: 'i1', src: placeholderFlowers, finalized: true },
    { id: 'i2', src: placeholderFlowers, finalized: false },
    { id: 'i3', src: placeholderFlowers, finalized: false },
  ],
};

const MOCK_SHOT_DETAIL = {
  shotNumber: '01',
  prompt: 'A lone detective walks through a rain-soaked alley at night, neon reflections shimmering on wet cobblestones, cinematic wide shot, shallow depth of field, moody noir atmosphere',
  model: 'Kling 2.1 Pro',
  resolution: '1920 × 1080',
  generatedAt: '2026-04-21 15:30:09',
  images: [
    { id: 's1', src: placeholderFlowers, finalized: true },
    { id: 's2', src: placeholderFlowers, finalized: false },
    { id: 's3', src: placeholderFlowers, finalized: false },
  ],
};

const MOCK_SHOT_VIDEO_DETAIL = {
  shotNumber: '03',
  prompt: 'A lone detective walks through a rain-soaked alley at night, neon reflections shimmering on wet cobblestones, cinematic wide shot, shallow depth of field, moody noir atmosphere',
  model: 'Kling 2.1 Pro',
  resolution: '1920 × 1080',
  duration: '0:24',
  ratio: '16:9',
  generatedAt: '2026-04-21 15:30:09',
  videoSrc: 'https://www.w3schools.com/html/mov_bbb.mp4',
  frames: [
    { id: 'v1', src: placeholderFlowers, finalized: true },
    { id: 'v2', src: placeholderFlowers, finalized: false },
    { id: 'v3', src: placeholderFlowers, finalized: false },
  ],
};

// 主体资产详情弹窗 — 图片列表（角色/场景/道具的多张图聚合）
function SubjectAssetDetailModal({ onClose, onDownload, onDeleteImage, onShowToast, name, description, images }) {
  const { width: modalW, height: modalH } = useModalSize();
  const imgs = images ?? [];
  const defaultIdx = imgs.findIndex((img) => img.is_primary);
  const [activeImg, setActiveImg] = useState(defaultIdx >= 0 ? defaultIdx : 0);
  const [hovClose, setHovClose] = useState(false);
  const [hovDownload, setHovDownload] = useState(false);
  const [hovDelete, setHovDelete] = useState(false);
  const [pressDelete, setPressDelete] = useState(false);
  const [hovThumb, setHovThumb] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [copyToast, setCopyToast] = useState(false);
  const copyToastTimer = useRef(null);
  function showCopyToast() {
    clearTimeout(copyToastTimer.current);
    setCopyToast(true);
    copyToastTimer.current = setTimeout(() => setCopyToast(false), 2000);
  }

  const currentImg = imgs[activeImg];
  const isPrimary = currentImg?.is_primary ?? false;
  const refImages = currentImg?.refImages ?? [];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: `${modalW}px`,
          height: `${modalH}px`,
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: '#00000099 -10px 24px 64px',
          backgroundColor: '#161616',
          border: '1px solid #FFFFFF14',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
          paddingTop: '20px',
          paddingBottom: '20px',
          paddingLeft: '24px',
          paddingRight: '24px',
          backgroundColor: '#161616',
        }}>
          <span style={{ fontFamily: FONT_MEDIUM, fontWeight: 500, fontSize: '16px', lineHeight: '20px', letterSpacing: '0.01em', color: '#FFFFFF' }}>查看详情</span>
          <button
            type="button"
            style={{
              width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: hovClose ? '#FFFFFF14' : 'transparent', border: 'none', cursor: 'pointer',
              borderRadius: '6px', padding: 0, flexShrink: 0, transition: 'background 0.12s',
            }}
            onMouseEnter={() => setHovClose(true)}
            onMouseLeave={() => setHovClose(false)}
            onClick={onClose}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
              <path d="M12 4L4 12M4 4L12 12" stroke="#FFFFFF99" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div style={{ display: 'flex', height: `${modalH - 60}px`, flex: 1 }}>
          {/* Left: preview + thumbnails */}
          <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, flexShrink: 1, flexBasis: '0%', minWidth: 0, minHeight: 0, backgroundColor: '#0D0D0D' }}>
            {/* Main image */}
            <div style={{ flexGrow: 1, flexShrink: 1, flexBasis: '0%', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0, position: 'relative', backgroundColor: '#0A0A0A' }}>
              <img
                src={currentImg?.fileUrl ?? currentImg?.url ?? placeholderFlowers}
                alt=""
                style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block', padding: '16px', boxSizing: 'border-box', transition: 'opacity 0.15s' }}
              />
            </div>

            {/* Ref images strip — if exist */}
            {refImages.length > 0 && (
              <div style={{
                flexShrink: 0,
                paddingTop: '12px', paddingBottom: '12px', paddingLeft: '16px', paddingRight: '16px',
                backgroundColor: '#111111',
                borderTop: '1px solid #FFFFFF0A',
              }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span style={{ fontFamily: FONT, fontSize: '12px', color: '#FFFFFF99', flexShrink: 0, whiteSpace: 'nowrap' }}>参考图：</span>
                  <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', flex: 1, minWidth: 0 }}>
                    {refImages.map((ref, idx) => (
                      <div
                        key={idx}
                        style={{
                          borderRadius: '4px', overflow: 'hidden',
                          width: '80px', height: '56px', flexShrink: 0,
                          backgroundColor: '#FFFFFF14',
                          border: '1px solid #FFFFFF33',
                          backgroundImage: `url(${ref.url})`,
                          backgroundSize: 'cover', backgroundPosition: '50%',
                        }}
                        title={ref.title}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Thumbnails strip */}
            <div style={{
              flexShrink: 0,
              paddingTop: '14px', paddingBottom: '16px', paddingLeft: '16px', paddingRight: '16px',
              backgroundColor: '#111111',
            }}>
              <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', alignItems: 'center' }}>
                {imgs.map((img, idx) => {
                  const isActive = activeImg === idx;
                  const isHov = hovThumb === idx;
                  return (
                    <div
                      key={img.id}
                      style={{
                        position: 'relative',
                        borderRadius: '6px', overflow: 'hidden',
                        width: '120px', height: '84px', flexShrink: 0,
                        boxShadow: isActive ? '#2DC3E166 0px 0px 10px 1px' : 'none',
                        backgroundColor: '#FFFFFF14',
                        border: isActive ? '1px solid #2DC3E1' : '1px solid #FFFFFF33',
                        cursor: 'pointer',
                        transition: 'border-color 0.15s, box-shadow 0.15s',
                      }}
                      onClick={() => setActiveImg(idx)}
                      onMouseEnter={() => setHovThumb(idx)}
                      onMouseLeave={() => setHovThumb(null)}
                    >
                      <div style={{
                        width: '100%', height: '100%',
                        backgroundImage: `url(${img.url ?? placeholderFlowers})`,
                        backgroundSize: 'cover', backgroundPosition: '50%',
                      }} />
                      {/* Primary badge */}
                      {img.is_primary && (
                        <div style={{
                          position: 'absolute', top: '4px', left: '4px',
                          paddingLeft: '4px', paddingRight: '4px', paddingTop: '2px', paddingBottom: '2px',
                          borderRadius: '2px', backgroundColor: '#4AC981',
                          boxShadow: '#FFFFFF14 0px 0px 0px 1px inset',
                          height: '18px',
                          display: 'flex',
                          alignItems: 'center',
                        }}>
                          <span style={{ fontFamily: FONT, fontSize: '10px', lineHeight: '14px', color: '#0A0A0A', fontWeight: 500 }}>定稿</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right: info panel */}
          <div style={{
            width: '280px', display: 'flex', flexDirection: 'column',
            minHeight: 0, flexShrink: 0,
            backgroundColor: '#161616', borderLeft: '1px solid #FFFFFF0F',
          }}>
            {/* Scrollable content */}
            <div style={{ flexGrow: 1, flexShrink: 1, flexBasis: '0%', overflowY: 'auto', minHeight: 0 }}>
              {/* Primary status */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px' }}>
                <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', letterSpacing: '0.01em', color: '#FFFFFF99' }}>是否定稿</span>
                {isPrimary ? (
                  <div style={{
                    paddingLeft: '4px', paddingRight: '4px', paddingTop: '2px', paddingBottom: '2px',
                    borderRadius: '2px', backgroundColor: '#4AC981',
                    boxShadow: '#FFFFFF14 0px 0px 0px 1px inset',
                    height: '18px',
                    display: 'flex',
                    alignItems: 'center',
                  }}>
                    <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '14px', color: '#0A0A0A', fontWeight: 500 }}>定稿</span>
                  </div>
                ) : (
                  <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', color: '#FFFFFF66' }}>否</span>
                )}
              </div>

              <div style={{ height: '1px', backgroundColor: '#FFFFFF0A', marginLeft: '20px', marginRight: '20px' }} />

              {/* Name + description */}
              <div style={{ display: 'flex', flexDirection: 'column', paddingTop: '16px', paddingBottom: '16px', paddingLeft: '20px', paddingRight: '20px', gap: '8px' }}>
                <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '20px', letterSpacing: '0.01em', color: '#FFFFFF' }}>{name}</span>
                {description && (
                  <p style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '20px', letterSpacing: '0.01em', color: '#FFFFFFCC', margin: 0 }}>{description}</p>
                )}
              </div>

              {/* Prompt */}
              {currentImg?.prompt && (
                <>
                  <div style={{ height: '1px', backgroundColor: '#FFFFFF0A', marginLeft: '20px', marginRight: '20px' }} />
                  <div style={{ display: 'flex', flexDirection: 'column', paddingTop: '16px', paddingBottom: '16px', paddingLeft: '20px', paddingRight: '20px', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                      <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '14px', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#FFFFFF99' }}>提示词</span>
                      <button
                        type="button"
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          width: '24px', height: '24px', borderRadius: '4px',
                          background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                          opacity: 0.6, transition: 'opacity 0.12s',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                        onMouseLeave={(e) => e.currentTarget.style.opacity = '0.6'}
                        onClick={() => {
                          navigator.clipboard.writeText(currentImg.prompt);
                          showCopyToast();
                        }}
                        title="复制提示词"
                      >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
                          <path d="M4.33337 4.14383V2.60413C4.33337 2.08636 4.75311 1.66663 5.27087 1.66663H13.3959C13.9136 1.66663 14.3334 2.08636 14.3334 2.60413V10.7291C14.3334 11.2469 13.9136 11.6666 13.3959 11.6666H11.8388" stroke="white" strokeOpacity="0.6" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M10.7291 4.33337H2.60413C2.08636 4.33337 1.66663 4.75311 1.66663 5.27087V13.3959C1.66663 13.9136 2.08636 14.3334 2.60413 14.3334H10.7291C11.2469 14.3334 11.6666 13.9136 11.6666 13.3959V5.27087C11.6666 4.75311 11.2469 4.33337 10.7291 4.33337Z" stroke="white" strokeOpacity="0.6" strokeLinejoin="round"/>
                        </svg>
                      </button>
                    </div>
                    <p style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '20px', letterSpacing: '0.01em', color: '#FFFFFFCC', margin: 0 }}>{currentImg.prompt}</p>
                  </div>
                </>
              )}

              {/* Generation params */}
              {(currentImg?.model || currentImg?.ratio || currentImg?.resolution) && (
                <>
                  <div style={{ height: '1px', backgroundColor: '#FFFFFF0A', marginLeft: '20px', marginRight: '20px' }} />
                  <div style={{ display: 'flex', flexDirection: 'column', paddingTop: '16px', paddingBottom: '16px', paddingLeft: '20px', paddingRight: '20px', gap: '12px' }}>
                    <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '14px', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#FFFFFF99' }}>生成参数</span>
                    {[
                      { label: '模型', value: currentImg.model },
                      { label: '画面比例', value: currentImg.ratio },
                      { label: '分辨率', value: currentImg.resolution },
                    ].filter(({ value }) => value).map(({ label, value }) => (
                      <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', letterSpacing: '0.01em', color: '#FFFFFF99' }}>{label}</span>
                        <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', letterSpacing: '0.01em', color: '#FFFFFFCC' }}>{value}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Created time */}
              {currentImg?.created_at && (
                <>
                  <div style={{ height: '1px', backgroundColor: '#FFFFFF0A', marginLeft: '20px', marginRight: '20px' }} />
                  <div style={{ display: 'flex', flexDirection: 'column', paddingTop: '16px', paddingBottom: '16px', paddingLeft: '20px', paddingRight: '20px', gap: '4px' }}>
                    <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '14px', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#FFFFFF99' }}>创建时间</span>
                    <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', letterSpacing: '0.01em', color: '#FFFFFF66' }}>{currentImg.created_at}</span>
                  </div>
                </>
              )}
            </div>

            {/* Sticky buttons */}
            <div style={{ flexShrink: 0, paddingTop: '12px', paddingBottom: '20px', paddingLeft: '20px', paddingRight: '20px', borderTop: '1px solid #FFFFFF0A', display: 'flex', gap: '8px' }}>
              <button
                  type="button"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flex: 1, height: '40px', borderRadius: '8px', gap: '8px',
                    backgroundColor: pressDelete ? '#FFFFFF26' : hovDelete ? '#FFFFFF1F' : '#FFFFFF14',
                    border: '1px solid #FFFFFF1F', cursor: 'pointer', transition: 'background-color 0.12s',
                    opacity: pressDelete ? 0.8 : 1,
                  }}
                  onMouseEnter={() => setHovDelete(true)}
                  onMouseLeave={() => { setHovDelete(false); setPressDelete(false); }}
                  onMouseDown={() => setPressDelete(true)}
                  onMouseUp={() => setPressDelete(false)}
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
                    <path d="M2.333 3.667V12.333C2.333 12.784 2.716 13.167 3.167 13.167H10.833C11.284 13.167 11.667 12.784 11.667 12.333V3.667" stroke="#FF6B6B" strokeLinejoin="round" />
                    <path d="M5.333 6V10.667" stroke="#FF6B6B" strokeLinecap="round" />
                    <path d="M8.667 6V10.667" stroke="#FF6B6B" strokeLinecap="round" />
                    <path d="M1 3.667H13" stroke="#FF6B6B" strokeLinecap="round" />
                    <path d="M4.333 3.667L5.15 1.333H8.85L9.667 3.667" stroke="#FF6B6B" strokeLinejoin="round" />
                  </svg>
                  <span style={{ fontFamily: FONT, fontSize: '13px', lineHeight: '16px', letterSpacing: '0.01em', color: '#FF6B6B' }}>删除</span>
                </button>
              <button
                type="button"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flex: 1, height: '40px', borderRadius: '8px', gap: '8px',
                  backgroundColor: hovDownload ? '#FFFFFF1F' : '#FFFFFF14',
                  border: '1px solid #FFFFFF1F', cursor: 'pointer', transition: 'background-color 0.12s',
                }}
                onMouseEnter={() => setHovDownload(true)}
                onMouseLeave={() => setHovDownload(false)}
                onClick={() => onDownload?.(currentImg.id, currentImg.fileUrl)}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
                  <path d="M7 2V9M7 9L4 6.5M7 9L10 6.5M2 11H12" stroke="#FFFFFF99" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span style={{ fontFamily: FONT, fontSize: '13px', lineHeight: '16px', letterSpacing: '0.01em', color: '#FFFFFF99' }}>下载</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <ConfirmDialog
          title="确定要删除吗？"
          description={`删除此图片后，将无法恢复。`}
          confirmText="删除"
          onCancel={() => setShowDeleteConfirm(false)}
          onConfirm={() => {
            setShowDeleteConfirm(false);
            onShowToast?.('删除成功', 'success');
            const deletedId = currentImg.id;
            if (imgs.length === 1) {
              // 最后一张：先关弹窗，再通知父组件删除
              onDeleteImage?.(deletedId);
            } else {
              // 切换到上一张（若是第一张则切到下一张）
              const nextIdx = activeImg > 0 ? activeImg - 1 : 0;
              setActiveImg(nextIdx);
              onDeleteImage?.(deletedId);
            }
          }}
          zIndex={300}
        />
      )}
      {copyToast && createPortal(
        <div style={{ position: 'fixed', top: '25vh', left: '50%', transform: 'translateX(-50%)', zIndex: 9999, pointerEvents: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '8px', background: 'rgba(30,30,30,0.92)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.1)', whiteSpace: 'nowrap' }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}><path d="M8 14.667C11.682 14.667 14.667 11.682 14.667 8C14.667 4.318 11.682 1.333 8 1.333C4.318 1.333 1.333 4.318 1.333 8C1.333 11.682 4.318 14.667 8 14.667Z" fill="#52BF92" stroke="#52BF92" strokeWidth="1.333" strokeLinejoin="round"/><path d="M5.333 8L7.333 10L11.333 6" stroke="#FFFFFF" strokeWidth="1.333" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <span style={{ fontSize: '14px', color: '#FFFFFF', fontFamily: "'AlibabaPuHuiTi_2_55_Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif" }}>提示词复制成功</span>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

// Props: name, description, prompt, model, ratio, resolution, images (array of {id, src, finalized})
// images[0] should be the finalized image; default activeImg = index of first finalized image
function AssetDetailModal({ onClose, onDownload, name, description, prompt, model, ratio, resolution, generatedAt, images }) {
  const { width: modalW, height: modalH } = useModalSize();
  const imgs = images ?? MOCK_DETAIL.images;
  const defaultIdx = imgs.findIndex((img) => img.finalized);
  const [activeImg, setActiveImg] = useState(defaultIdx >= 0 ? defaultIdx : 0);
  const [hovClose, setHovClose] = useState(false);
  const [hovDownload, setHovDownload] = useState(false);
  const [hovThumb, setHovThumb] = useState(null);
  const [copyToast, setCopyToast] = useState(false);
  const copyToastTimer = useRef(null);
  function showCopyToast() {
    clearTimeout(copyToastTimer.current);
    setCopyToast(true);
    copyToastTimer.current = setTimeout(() => setCopyToast(false), 2000);
  }

  const currentImg = imgs[activeImg];
  const isFinalized = currentImg?.finalized ?? false;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: `${modalW}px`,
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: '#00000099 -10px 24px 64px',
          backgroundColor: '#161616',
          border: '1px solid #FFFFFF14',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
          paddingTop: '20px',
          paddingBottom: '20px',
          paddingLeft: '24px',
          paddingRight: '24px',
          backgroundColor: '#161616',
        }}>
          <span style={{ fontFamily: FONT_MEDIUM, fontWeight: 500, fontSize: '16px', lineHeight: '20px', letterSpacing: '0.01em', color: '#FFFFFF' }}>查看详情</span>
          <button
            type="button"
            style={{
              width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: hovClose ? '#FFFFFF14' : 'transparent', border: 'none', cursor: 'pointer',
              borderRadius: '6px', padding: 0, flexShrink: 0, transition: 'background 0.12s',
            }}
            onMouseEnter={() => setHovClose(true)}
            onMouseLeave={() => setHovClose(false)}
            onClick={onClose}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
              <path d="M12 4L4 12M4 4L12 12" stroke="#FFFFFF99" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div style={{ display: 'flex', height: `${modalH - 60}px` }}>
          {/* Left: preview */}
          <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, flexShrink: 1, flexBasis: '0%', minWidth: 0, minHeight: 0, backgroundColor: '#0D0D0D' }}>
            {/* Main image */}
            <div style={{ flexGrow: 1, flexShrink: 1, flexBasis: '0%', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0, position: 'relative', backgroundColor: '#0A0A0A' }}>
              <img
                src={currentImg?.src ?? placeholderFlowers}
                alt=""
                style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block', padding: '16px', boxSizing: 'border-box', transition: 'opacity 0.15s' }}
              />
            </div>
            {/* Thumbnails strip */}
            <div style={{
              flexShrink: 0,
              paddingTop: '14px', paddingBottom: '16px', paddingLeft: '16px', paddingRight: '16px',
              backgroundColor: '#111111',
            }}>
              <div style={{ display: 'flex', gap: '12px', overflowX: 'auto' }}>
                {imgs.map((img, idx) => {
                  const isActive = activeImg === idx;
                  const isHov = hovThumb === idx;
                  return (
                    <div
                      key={img.id}
                      style={{
                        borderRadius: '6px', overflow: 'hidden',
                        width: '120px', height: '84px', flexShrink: 0,
                        boxShadow: isActive ? '#2DC3E166 0px 0px 10px 1px' : 'none',
                        backgroundColor: '#FFFFFF14',
                        border: isActive ? '1px solid #2DC3E1' : '1px solid #FFFFFF33',
                        cursor: 'pointer', position: 'relative',
                        transition: 'border-color 0.15s, box-shadow 0.15s',
                      }}
                      onClick={() => setActiveImg(idx)}
                      onMouseEnter={() => setHovThumb(idx)}
                      onMouseLeave={() => setHovThumb(null)}
                    >
                      <div style={{
                        width: '100%', height: '100%',
                        backgroundImage: `url(${img.src ?? placeholderFlowers})`,
                        backgroundSize: 'cover', backgroundPosition: '50%',
                      }} />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right: info panel — scrollable content + sticky download */}
          <div style={{
            width: '280px', display: 'flex', flexDirection: 'column',
            height: `${modalH - 60}px`, flexShrink: 0,
            backgroundColor: '#161616', borderLeft: '1px solid #FFFFFF0F',
          }}>
            {/* Scrollable content */}
            <div style={{ flexGrow: 1, flexShrink: 1, flexBasis: '0%', overflowY: 'auto', minHeight: 0 }}>
              {/* Finalized status */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px' }}>
                <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', letterSpacing: '0.01em', color: '#FFFFFF99' }}>是否定稿</span>
                {isFinalized ? (
                  <div style={{
                    paddingLeft: '8px', paddingRight: '8px', paddingTop: '2px', paddingBottom: '2px',
                    borderRadius: '4px', boxShadow: '#FFFFFF14 0px 0px 0px 1px inset', backgroundColor: '#7AE5B91A',
                  }}>
                    <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', color: '#7AE5B9' }}>定稿</span>
                  </div>
                ) : (
                  <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', color: '#FFFFFF66' }}>否</span>
                )}
              </div>

              <div style={{ height: '1px', backgroundColor: '#FFFFFF0A', marginLeft: '20px', marginRight: '20px' }} />

              {/* Name + description */}
              <div style={{ display: 'flex', flexDirection: 'column', paddingTop: '16px', paddingBottom: '16px', paddingLeft: '20px', paddingRight: '20px', gap: '8px' }}>
                <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '20px', letterSpacing: '0.01em', color: '#FFFFFF' }}>{name ?? MOCK_DETAIL.name}</span>
                <p style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '20px', letterSpacing: '0.01em', color: '#FFFFFFCC', margin: 0 }}>{description ?? MOCK_DETAIL.description}</p>
              </div>

              {/* Prompt */}
              <div style={{ display: 'flex', flexDirection: 'column', paddingTop: '16px', paddingBottom: '16px', paddingLeft: '20px', paddingRight: '20px', gap: '10px' }}>
                <span style={{ fontFamily: FONT, fontSize: '11px', lineHeight: '14px', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#FFFFFF99' }}>提示词</span>
                <p style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '20px', letterSpacing: '0.01em', color: '#FFFFFFCC', margin: 0 }}>{prompt ?? MOCK_DETAIL.prompt}</p>
              </div>

              <div style={{ height: '1px', backgroundColor: '#FFFFFF0A', marginLeft: '20px', marginRight: '20px' }} />

              {/* Generation params */}
              <div style={{ display: 'flex', flexDirection: 'column', paddingTop: '16px', paddingBottom: '16px', paddingLeft: '20px', paddingRight: '20px', gap: '12px' }}>
                <span style={{ fontFamily: FONT, fontSize: '11px', lineHeight: '14px', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#FFFFFF99' }}>生成参数</span>
                {[
                  { label: '模型', value: model ?? MOCK_DETAIL.model },
                  { label: '画面比例', value: ratio ?? MOCK_DETAIL.ratio },
                  { label: '分辨率', value: resolution ?? MOCK_DETAIL.resolution },
                ].map(({ label, value }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', letterSpacing: '0.01em', color: '#FFFFFF99' }}>{label}</span>
                    <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', letterSpacing: '0.01em', color: '#FFFFFFCC' }}>{value}</span>
                  </div>
                ))}
              </div>

              <div style={{ height: '1px', backgroundColor: '#FFFFFF0A', marginLeft: '20px', marginRight: '20px' }} />

              {/* AI generated time */}
              <div style={{ display: 'flex', flexDirection: 'column', paddingTop: '16px', paddingBottom: '16px', paddingLeft: '20px', paddingRight: '20px', gap: '4px' }}>
                <span style={{ fontFamily: FONT, fontSize: '11px', lineHeight: '14px', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#FFFFFF99' }}>AI 生成时间</span>
                <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', letterSpacing: '0.01em', color: '#FFFFFF66' }}>{generatedAt ?? MOCK_DETAIL.generatedAt}</span>
              </div>
            </div>

            {/* Sticky download button */}
            <div style={{ flexShrink: 0, paddingTop: '12px', paddingBottom: '20px', paddingLeft: '20px', paddingRight: '20px', borderTop: '1px solid #FFFFFF0A' }}>
              <button
                type="button"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: '100%', height: '40px', borderRadius: '8px', gap: '8px',
                  backgroundColor: hovDownload ? '#FFFFFF1F' : '#FFFFFF14',
                  border: '1px solid #FFFFFF1F', cursor: 'pointer', transition: 'background-color 0.12s',
                }}
                onMouseEnter={() => setHovDownload(true)}
                onMouseLeave={() => setHovDownload(false)}
                onClick={onDownload}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
                  <path d="M7 2V9M7 9L4 6.5M7 9L10 6.5M2 11H12" stroke="#FFFFFF99" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span style={{ fontFamily: FONT, fontSize: '13px', lineHeight: '16px', letterSpacing: '0.01em', color: '#FFFFFF99' }}>下载</span>
              </button>
            </div>
          </div>
        </div>
      </div>
      {copyToast && createPortal(
        <div style={{ position: 'fixed', top: '25vh', left: '50%', transform: 'translateX(-50%)', zIndex: 9999, pointerEvents: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '8px', background: 'rgba(30,30,30,0.92)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.1)', whiteSpace: 'nowrap' }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}><path d="M8 14.667C11.682 14.667 14.667 11.682 14.667 8C14.667 4.318 11.682 1.333 8 1.333C4.318 1.333 1.333 4.318 1.333 8C1.333 11.682 4.318 14.667 8 14.667Z" fill="#52BF92" stroke="#52BF92" strokeWidth="1.333" strokeLinejoin="round"/><path d="M5.333 8L7.333 10L11.333 6" stroke="#FFFFFF" strokeWidth="1.333" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <span style={{ fontSize: '14px', color: '#FFFFFF', fontFamily: "'AlibabaPuHuiTi_2_55_Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif" }}>提示词复制成功</span>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

// Props: shotNumber, prompt, model, resolution, images (array of {id, src, finalized})
function ShotDetailModal({ onClose, onDownload, onDelete, onShowToast, shotNumber, prompt, model, resolution, generatedAt, images, refImages }) {
  const { width: modalW, height: modalH } = useModalSize();
  const imgs = images ?? MOCK_SHOT_DETAIL.images;
  const defaultIdx = imgs.findIndex((img) => img.finalized);
  const [activeImg, setActiveImg] = useState(defaultIdx >= 0 ? defaultIdx : 0);
  const [hovClose, setHovClose] = useState(false);
  const [hovDownload, setHovDownload] = useState(false);
  const [hovDelete, setHovDelete] = useState(false);
  const [pressDelete, setPressDelete] = useState(false);
  const [hovThumb, setHovThumb] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [copyToast, setCopyToast] = useState(false);
  const copyToastTimer = useRef(null);
  function showCopyToast() {
    clearTimeout(copyToastTimer.current);
    setCopyToast(true);
    copyToastTimer.current = setTimeout(() => setCopyToast(false), 2000);
  }

  const currentImg = imgs[activeImg];
  const isFinalized = currentImg?.finalized ?? false;
  const refImgs = refImages ?? [];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: `${modalW}px`,
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: '#00000099 -10px 24px 64px',
          backgroundColor: '#161616',
          border: '1px solid #FFFFFF14',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
          paddingTop: '20px',
          paddingBottom: '20px',
          paddingLeft: '24px',
          paddingRight: '24px',
          backgroundColor: '#161616',
        }}>
          <span style={{ fontFamily: FONT_MEDIUM, fontWeight: 500, fontSize: '16px', lineHeight: '20px', letterSpacing: '0.01em', color: '#FFFFFF' }}>查看详情</span>
          <button
            type="button"
            style={{
              width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: hovClose ? '#FFFFFF14' : 'transparent', border: 'none', cursor: 'pointer',
              borderRadius: '6px', padding: 0, flexShrink: 0, transition: 'background 0.12s',
            }}
            onMouseEnter={() => setHovClose(true)}
            onMouseLeave={() => setHovClose(false)}
            onClick={onClose}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
              <path d="M12 4L4 12M4 4L12 12" stroke="#FFFFFF99" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div style={{ display: 'flex', height: `${modalH - 60}px` }}>
          {/* Left: preview */}
          <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, flexShrink: 1, flexBasis: '0%', minWidth: 0, minHeight: 0, backgroundColor: '#0D0D0D' }}>
            {/* Main image */}
            <div style={{ flexGrow: 1, flexShrink: 1, flexBasis: '0%', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0, position: 'relative', backgroundColor: '#0A0A0A' }}>
              <img
                src={currentImg?.src ?? placeholderFlowers}
                alt=""
                style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block', padding: '16px', boxSizing: 'border-box', transition: 'opacity 0.15s' }}
              />
            </div>
            {/* Thumbnails strip */}
            <div style={{
              flexShrink: 0,
              paddingTop: '14px', paddingBottom: '16px', paddingLeft: '16px', paddingRight: '16px',
              backgroundColor: '#111111',
            }}>
              <div style={{ display: 'flex', gap: '12px', overflowX: 'auto' }}>
                {imgs.map((img, idx) => {
                  const isActive = activeImg === idx;
                  const isHov = hovThumb === idx;
                  return (
                    <div
                      key={img.id}
                      style={{
                        borderRadius: '6px', overflow: 'hidden',
                        width: '120px', height: '84px', flexShrink: 0,
                        boxShadow: isActive ? '#2DC3E166 0px 0px 10px 1px' : 'none',
                        backgroundColor: '#FFFFFF14',
                        border: isActive ? '1px solid #2DC3E1' : '1px solid #FFFFFF33',
                        cursor: 'pointer', position: 'relative',
                        transition: 'border-color 0.15s, box-shadow 0.15s',
                      }}
                      onClick={() => setActiveImg(idx)}
                      onMouseEnter={() => setHovThumb(idx)}
                      onMouseLeave={() => setHovThumb(null)}
                    >
                      <div style={{
                        width: '100%', height: '100%',
                        backgroundImage: `url(${img.src ?? placeholderFlowers})`,
                        backgroundSize: 'cover', backgroundPosition: '50%',
                      }} />
                      {/* 定稿标签 */}
                      {img.finalized && (
                        <div style={{
                          position: 'absolute', top: '4px', left: '4px',
                          paddingLeft: '4px', paddingRight: '4px',
                          borderRadius: '2px', backgroundColor: '#4AC981',
                          boxShadow: '#FFFFFF14 0px 0px 0px 1px inset',
                          height: '18px', display: 'flex', alignItems: 'center',
                        }}>
                          <span style={{ fontFamily: FONT, fontSize: '10px', lineHeight: '14px', color: '#0A0A0A', fontWeight: 500 }}>定稿</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right: info panel — scrollable content + sticky download */}
          <div style={{
            width: '280px', display: 'flex', flexDirection: 'column',
            height: `${modalH - 60}px`, flexShrink: 0,
            backgroundColor: '#161616', borderLeft: '1px solid #FFFFFF0F',
          }}>
            {/* Scrollable content */}
            <div style={{ flexGrow: 1, flexShrink: 1, flexBasis: '0%', overflowY: 'auto', minHeight: 0 }}>
              {/* Finalized status */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px' }}>
                <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', letterSpacing: '0.01em', color: '#FFFFFF99' }}>是否定稿</span>
                {isFinalized ? (
                  <div style={{
                    paddingLeft: '4px', paddingRight: '4px', paddingTop: '2px', paddingBottom: '2px',
                    borderRadius: '2px', backgroundColor: '#4AC981',
                    boxShadow: '#FFFFFF14 0px 0px 0px 1px inset',
                    height: '18px',
                    display: 'flex',
                    alignItems: 'center',
                  }}>
                    <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '14px', color: '#0A0A0A', fontWeight: 500 }}>定稿</span>
                  </div>
                ) : (
                  <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', color: '#FFFFFF66' }}>否</span>
                )}
              </div>

              <div style={{ height: '1px', backgroundColor: '#FFFFFF0A', marginLeft: '20px', marginRight: '20px' }} />

              {/* Shot number */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '16px', paddingBottom: '16px', paddingLeft: '20px', paddingRight: '20px', gap: '10px' }}>
                <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', letterSpacing: '0.01em', color: '#FFFFFF99' }}>分镜编号</span>
                <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', letterSpacing: '0.01em', color: '#FFFFFFCC' }}>{shotNumber ?? MOCK_SHOT_DETAIL.shotNumber}</span>
              </div>

              <div style={{ height: '1px', backgroundColor: '#FFFFFF0A', marginLeft: '20px', marginRight: '20px' }} />

              {/* Prompt */}
              {((currentImg?.prompt || prompt) ?? MOCK_SHOT_DETAIL.prompt) && (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', paddingTop: '16px', paddingBottom: '16px', paddingLeft: '20px', paddingRight: '20px', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                      <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '14px', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#FFFFFF99' }}>提示词</span>
                      <button
                        type="button"
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          width: '24px', height: '24px', borderRadius: '4px',
                          background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                          opacity: 0.6, transition: 'opacity 0.12s',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                        onMouseLeave={(e) => e.currentTarget.style.opacity = '0.6'}
                        onClick={() => {
                          navigator.clipboard.writeText((currentImg?.prompt || prompt) ?? MOCK_SHOT_DETAIL.prompt);
                          showCopyToast();
                        }}
                        title="复制提示词"
                      >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
                          <path d="M4.33337 4.14383V2.60413C4.33337 2.08636 4.75311 1.66663 5.27087 1.66663H13.3959C13.9136 1.66663 14.3334 2.08636 14.3334 2.60413V10.7291C14.3334 11.2469 13.9136 11.6666 13.3959 11.6666H11.8388" stroke="white" strokeOpacity="0.6" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M10.7291 4.33337H2.60413C2.08636 4.33337 1.66663 4.75311 1.66663 5.27087V13.3959C1.66663 13.9136 2.08636 14.3334 2.60413 14.3334H10.7291C11.2469 14.3334 11.6666 13.9136 11.6666 13.3959V5.27087C11.6666 4.75311 11.2469 4.33337 10.7291 4.33337Z" stroke="white" strokeOpacity="0.6" strokeLinejoin="round"/>
                        </svg>
                      </button>
                    </div>
                    <p style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '20px', letterSpacing: '0.01em', color: '#FFFFFFCC', margin: 0 }}>{(currentImg?.prompt || prompt) ?? MOCK_SHOT_DETAIL.prompt}</p>
                  </div>
                  <div style={{ height: '1px', backgroundColor: '#FFFFFF0A', marginLeft: '20px', marginRight: '20px' }} />
                </>
              )}

              {/* Ref images */}
              {refImgs.length > 0 && (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', paddingTop: '16px', paddingBottom: '16px', paddingLeft: '20px', paddingRight: '20px', gap: '10px' }}>
                    <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '14px', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#FFFFFF99' }}>参考图</span>
                    <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', flex: 1, minWidth: 0 }}>
                      {refImgs.map((ref, idx) => (
                        <div
                          key={idx}
                          style={{
                            borderRadius: '4px', overflow: 'hidden',
                            width: '80px', height: '56px', flexShrink: 0,
                            backgroundColor: '#FFFFFF14',
                            border: '1px solid #FFFFFF33',
                            backgroundImage: `url(${ref.url})`,
                            backgroundSize: 'cover', backgroundPosition: '50%',
                          }}
                          title={ref.title}
                        />
                      ))}
                    </div>
                  </div>
                  <div style={{ height: '1px', backgroundColor: '#FFFFFF0A', marginLeft: '20px', marginRight: '20px' }} />
                </>
              )}

              {/* Generation params */}
              <div style={{ display: 'flex', flexDirection: 'column', paddingTop: '16px', paddingBottom: '16px', paddingLeft: '20px', paddingRight: '20px', gap: '12px' }}>
                <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '14px', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#FFFFFF99' }}>生成参数</span>
                {[
                  { label: '模型', value: (currentImg?.model || model) ?? MOCK_SHOT_DETAIL.model },
                  { label: '分辨率', value: (currentImg?.resolution || resolution) ?? MOCK_SHOT_DETAIL.resolution },
                ].map(({ label, value }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', letterSpacing: '0.01em', color: '#FFFFFF99' }}>{label}</span>
                    <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', letterSpacing: '0.01em', color: '#FFFFFFCC' }}>{value}</span>
                  </div>
                ))}
              </div>

              <div style={{ height: '1px', backgroundColor: '#FFFFFF0A', marginLeft: '20px', marginRight: '20px' }} />

              {/* AI generated time */}
              <div style={{ display: 'flex', flexDirection: 'column', paddingTop: '16px', paddingBottom: '16px', paddingLeft: '20px', paddingRight: '20px', gap: '4px' }}>
                <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '14px', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#FFFFFF99' }}>AI 生成时间</span>
                <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', letterSpacing: '0.01em', color: '#FFFFFF66' }}>{(currentImg?.generatedAt || generatedAt) ?? MOCK_SHOT_DETAIL.generatedAt}</span>
              </div>
            </div>

            {/* Sticky buttons */}
            <div style={{ flexShrink: 0, paddingTop: '12px', paddingBottom: '20px', paddingLeft: '20px', paddingRight: '20px', borderTop: '1px solid #FFFFFF0A', display: 'flex', gap: '8px' }}>
              {onDelete && (
                <button
                  type="button"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flex: 1, height: '40px', borderRadius: '8px', gap: '8px',
                    backgroundColor: pressDelete ? '#FFFFFF26' : hovDelete ? '#FFFFFF1F' : '#FFFFFF14',
                    border: '1px solid #FFFFFF1F', cursor: 'pointer', transition: 'background-color 0.12s',
                    opacity: pressDelete ? 0.8 : 1,
                  }}
                  onMouseEnter={() => setHovDelete(true)}
                  onMouseLeave={() => { setHovDelete(false); setPressDelete(false); }}
                  onMouseDown={() => setPressDelete(true)}
                  onMouseUp={() => setPressDelete(false)}
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
                    <path d="M2.333 3.667V12.333C2.333 12.784 2.716 13.167 3.167 13.167H10.833C11.284 13.167 11.667 12.784 11.667 12.333V3.667" stroke="#FF6B6B" strokeLinejoin="round" />
                    <path d="M5.333 6V10.667" stroke="#FF6B6B" strokeLinecap="round" />
                    <path d="M8.667 6V10.667" stroke="#FF6B6B" strokeLinecap="round" />
                    <path d="M1 3.667H13" stroke="#FF6B6B" strokeLinecap="round" />
                    <path d="M4.333 3.667L5.15 1.333H8.85L9.667 3.667" stroke="#FF6B6B" strokeLinejoin="round" />
                  </svg>
                  <span style={{ fontFamily: FONT, fontSize: '13px', lineHeight: '16px', letterSpacing: '0.01em', color: '#FF6B6B' }}>删除</span>
                </button>
              )}
              <button
                type="button"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flex: 1, height: '40px', borderRadius: '8px', gap: '8px',
                  backgroundColor: hovDownload ? '#FFFFFF1F' : '#FFFFFF14',
                  border: '1px solid #FFFFFF1F', cursor: 'pointer', transition: 'background-color 0.12s',
                }}
                onMouseEnter={() => setHovDownload(true)}
                onMouseLeave={() => setHovDownload(false)}
                onClick={onDownload}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
                  <path d="M7 2V9M7 9L4 6.5M7 9L10 6.5M2 11H12" stroke="#FFFFFF99" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span style={{ fontFamily: FONT, fontSize: '13px', lineHeight: '16px', letterSpacing: '0.01em', color: '#FFFFFF99' }}>下载</span>
              </button>
            </div>

            {/* Delete confirmation */}
            {showDeleteConfirm && (
              <ConfirmDialog
                title="确定要删除吗？"
                description="删除后，该资产将被清除且不可恢复。"
                confirmText="删除"
                onCancel={() => setShowDeleteConfirm(false)}
                onConfirm={() => { setShowDeleteConfirm(false); onShowToast?.('删除成功', 'success'); onDelete?.(); }}
                zIndex={300}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function VideoFrameThumbnail({ frame, isActive, isHov, onSelect, onMouseEnter, onMouseLeave }) {
  return (
    <div
      style={{
        borderRadius: '6px', overflow: 'hidden',
        width: '120px', height: '84px', flexShrink: 0,
        boxShadow: isActive ? '#2DC3E166 0px 0px 10px 1px' : 'none',
        backgroundColor: '#1A1A1A',
        border: isActive ? '1px solid #2DC3E1' : '1px solid #FFFFFF33',
        cursor: 'pointer', position: 'relative',
        transition: 'border-color 0.15s, box-shadow 0.15s',
      }}
      onClick={onSelect}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {frame.src ? (
        <video
          src={frame.src}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          preload="metadata"
          muted
          playsInline
        />
      ) : (
        <div style={{
          width: '100%', height: '100%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'linear-gradient(135deg, #2A2A2A 0%, #1F1F1F 100%)',
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
            <rect x="2" y="2" width="20" height="20" rx="3" stroke="#FFFFFF33" strokeLinejoin="round" />
            <path d="M9 8L16 12L9 16V8Z" fill="#FFFFFF33" />
          </svg>
        </div>
      )}

      {/* 定稿标签 */}
      {frame.finalized && (
        <div style={{
          position: 'absolute', top: '4px', left: '4px',
          paddingLeft: '4px', paddingRight: '4px',
          borderRadius: '2px', backgroundColor: '#4AC981',
          boxShadow: '#FFFFFF14 0px 0px 0px 1px inset',
          height: '18px', display: 'flex', alignItems: 'center',
        }}>
          <span style={{ fontFamily: FONT, fontSize: '10px', lineHeight: '14px', color: '#0A0A0A', fontWeight: 500 }}>定稿</span>
        </div>
      )}

    </div>
  );
}

function ShotVideoDetailModal({ onClose, onDownload, onDelete, onShowToast, shotNumber, prompt, model, resolution, duration, ratio, generatedAt, frames, videoSrc, refMode, firstFrame, lastFrame, sound, refImages, refVideos }) {
  const { width: modalW, height: modalH } = useModalSize();
  const frms = frames ?? MOCK_SHOT_VIDEO_DETAIL.frames;
  const defaultIdx = frms.findIndex((f) => f.finalized);
  const [activeFrame, setActiveFrame] = useState(defaultIdx >= 0 ? defaultIdx : 0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [volume, setVolume] = useState(0.7);
  const [hovClose, setHovClose] = useState(false);
  const [hovDownload, setHovDownload] = useState(false);
  const [hovDelete, setHovDelete] = useState(false);
  const [pressDelete, setPressDelete] = useState(false);
  const [hovThumb, setHovThumb] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [copyToast, setCopyToast] = useState(false);
  const copyToastTimer = useRef(null);
  function showCopyToast() {
    clearTimeout(copyToastTimer.current);
    setCopyToast(true);
    copyToastTimer.current = setTimeout(() => setCopyToast(false), 2000);
  }
  const videoRef = useRef(null);
  const progressBarRef = useRef(null);
  const volumeBarRef = useRef(null);
  const isDraggingRef = useRef(false);

  const currentFrame = frms[activeFrame];
  const isFinalized = currentFrame?.finalized ?? false;
  const sn = shotNumber ?? MOCK_SHOT_VIDEO_DETAIL.shotNumber;
  // src 优先取当前缩略图对应的视频，无则 fallback 到主视频
  const src = currentFrame?.src || videoSrc || MOCK_SHOT_VIDEO_DETAIL.videoSrc;

  // 切换缩略图时重置播放状态并加载新视频
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    vid.pause();
    setIsPlaying(false);
    setCurrentTime(0);
    vid.load();
  }, [src]);

  function fmtTime(secs) {
    if (!isFinite(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    const onTimeUpdate = () => setCurrentTime(vid.currentTime);
    const onLoaded = () => { setVideoDuration(vid.duration); vid.volume = volume; };
    const onEnded = () => setIsPlaying(false);
    vid.addEventListener('timeupdate', onTimeUpdate);
    vid.addEventListener('loadedmetadata', onLoaded);
    vid.addEventListener('ended', onEnded);
    return () => {
      vid.removeEventListener('timeupdate', onTimeUpdate);
      vid.removeEventListener('loadedmetadata', onLoaded);
      vid.removeEventListener('ended', onEnded);
    };
  }, []);

  function togglePlay() {
    const vid = videoRef.current;
    if (!vid) return;
    if (vid.paused) { vid.play(); setIsPlaying(true); }
    else { vid.pause(); setIsPlaying(false); }
  }

  function seekFromEvent(e, bar) {
    const rect = bar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const vid = videoRef.current;
    if (vid && isFinite(vid.duration)) {
      vid.currentTime = ratio * vid.duration;
      setCurrentTime(vid.currentTime);
    }
  }

  function handleProgressMouseDown(e) {
    isDraggingRef.current = true;
    seekFromEvent(e, progressBarRef.current);
    const onMove = (ev) => { if (isDraggingRef.current) seekFromEvent(ev, progressBarRef.current); };
    const onUp = () => { isDraggingRef.current = false; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  function handleVolumeClick(e) {
    const rect = volumeBarRef.current.getBoundingClientRect();
    const v = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setVolume(v);
    if (videoRef.current) videoRef.current.volume = v;
  }

  const progressPct = videoDuration > 0 ? (currentTime / videoDuration) * 100 : 0;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          display: 'flex', flexDirection: 'column', width: `${modalW}px`,
          borderRadius: '16px', overflow: 'hidden',
          boxShadow: '#00000099 -10px 24px 64px',
          backgroundColor: '#161616', border: '1px solid #FFFFFF14',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0, paddingTop: '20px', paddingBottom: '20px',
          paddingLeft: '24px', paddingRight: '24px', backgroundColor: '#161616',
        }}>
          <span style={{ fontFamily: FONT_MEDIUM, fontWeight: 500, fontSize: '16px', lineHeight: '20px', letterSpacing: '0.01em', color: '#FFFFFF' }}>查看详情</span>
          <button
            type="button"
            style={{
              width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: hovClose ? '#FFFFFF14' : 'transparent', border: 'none', cursor: 'pointer',
              borderRadius: '6px', padding: 0, flexShrink: 0, transition: 'background 0.12s',
            }}
            onMouseEnter={() => setHovClose(true)}
            onMouseLeave={() => setHovClose(false)}
            onClick={onClose}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
              <path d="M12 4L4 12M4 4L12 12" stroke="#FFFFFF99" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div style={{ display: 'flex', height: `${modalH - 60}px` }}>
          {/* Left: video player */}
          <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, flexShrink: 1, flexBasis: '0%', minWidth: 0, minHeight: 0, backgroundColor: '#0D0D0D' }}>
            {/* Main video preview */}
            <div style={{ flexGrow: 1, flexShrink: 1, flexBasis: '0%', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0, backgroundColor: '#0A0A0A' }}>
              <div style={{
                width: '100%', aspectRatio: '16/9',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden', alignSelf: 'stretch', position: 'relative',
                backgroundColor: '#111111',
              }}>
                {/* Real video element */}
                <video
                  ref={videoRef}
                  src={src}
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }}
                  preload="metadata"
                />
                {/* Bottom gradient overlay */}
                <div style={{
                  position: 'absolute', inset: 0,
                  backgroundImage: 'linear-gradient(in oklab 180deg, oklab(0% 0 0 / 0%) 40%, oklab(0% 0 0 / 40%) 100%)',
                  pointerEvents: 'none',
                }} />
                {/* Play/pause button */}
                <button
                  type="button"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    borderRadius: '50%', position: 'relative', flexShrink: 0,
                    backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
                    backgroundColor: '#FFFFFF1F', border: '1px solid #FFFFFF33',
                    width: '56px', height: '56px', cursor: 'pointer',
                  }}
                  onClick={togglePlay}
                >
                  {isPlaying ? (
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}>
                      <rect x="4" y="4" width="4" height="12" rx="1" fill="#FFFFFF" />
                      <rect x="12" y="4" width="4" height="12" rx="1" fill="#FFFFFF" />
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}>
                      <path d="M7 5L16 10L7 15V5Z" fill="#FFFFFF" />
                    </svg>
                  )}
                </button>
                {/* Shot label */}
                <div style={{
                  position: 'absolute', top: '12px', left: '12px',
                  borderRadius: '6px', paddingTop: '4px', paddingBottom: '4px',
                  paddingLeft: '8px', paddingRight: '8px',
                  backgroundColor: '#00000080',
                }}>
                  <span style={{ fontFamily: FONT, fontSize: '11px', lineHeight: '14px', letterSpacing: '0.02em', color: '#FFFFFF99' }}>镜头 {sn}</span>
                </div>
              </div>
            </div>

            {/* Controls bar */}
            <div style={{
              flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              paddingTop: '14px', paddingBottom: '16px', paddingLeft: '16px', paddingRight: '16px',
              gap: '10px', backgroundColor: '#111111',
            }}>
              {/* Play/pause small */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    borderRadius: '50%', flexShrink: 0,
                    backgroundColor: '#FFFFFF1A', border: '1px solid #FFFFFF26',
                    width: '32px', height: '32px', cursor: 'pointer',
                  }}
                  onClick={togglePlay}
                >
                  {isPlaying ? (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
                      <rect x="2.5" y="2.5" width="3" height="9" rx="0.75" fill="#FFFFFF" />
                      <rect x="8.5" y="2.5" width="3" height="9" rx="0.75" fill="#FFFFFF" />
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
                      <path d="M5 3L12 7L5 11V3Z" fill="#FFFFFF" />
                    </svg>
                  )}
                </button>
              </div>
              {/* Progress */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', letterSpacing: '0.01em', color: '#FFFFFF99', flexShrink: 0, width: '36px' }}>{fmtTime(currentTime)}</span>
                <div
                  ref={progressBarRef}
                  style={{ flexGrow: 1, height: '12px', display: 'flex', alignItems: 'center', cursor: 'pointer', position: 'relative' }}
                  onMouseDown={handleProgressMouseDown}
                >
                  <div style={{ width: '100%', height: '3px', borderRadius: '2px', backgroundColor: '#FFFFFF1F', position: 'relative' }}>
                    <div style={{ width: `${progressPct}%`, height: '100%', borderRadius: '2px', backgroundColor: '#FFFFFFB3', position: 'relative' }}>
                      <div style={{
                        position: 'absolute', right: '-5px', top: '50%',
                        width: '10px', height: '10px', borderRadius: '50%',
                        boxShadow: '#00000080 0px 0px 4px', backgroundColor: '#FFFFFF',
                        transform: 'translateY(-50%)',
                      }} />
                    </div>
                  </div>
                </div>
                <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', letterSpacing: '0.01em', color: '#FFFFFF40', flexShrink: 0, width: '36px', textAlign: 'right' }}>{fmtTime(videoDuration)}</span>
              </div>
              {/* Volume */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ opacity: 0.4, flexShrink: 0 }}>
                  <path d="M3 6H1V10H3L7 13V3L3 6Z" fill="#FFFFFF" />
                  <path d="M10 5C11.1 6.1 11.1 9.9 10 11M12.5 3C14.7 5.2 14.7 10.8 12.5 13" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
                <div
                  ref={volumeBarRef}
                  style={{ width: '60px', height: '12px', display: 'flex', alignItems: 'center', cursor: 'pointer', flexShrink: 0 }}
                  onClick={handleVolumeClick}
                >
                  <div style={{ width: '100%', height: '3px', borderRadius: '2px', backgroundColor: '#FFFFFF1F' }}>
                    <div style={{ width: `${volume * 100}%`, height: '100%', borderRadius: '2px', backgroundColor: '#FFFFFF99' }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Thumbnails strip */}
            <div style={{
              flexShrink: 0,
              paddingTop: '12px', paddingBottom: '16px', paddingLeft: '16px', paddingRight: '16px',
              backgroundColor: '#111111', borderTop: '1px solid #FFFFFF14',
            }}>
              <div style={{ display: 'flex', gap: '10px', overflowX: 'auto' }}>
                {frms.map((frm, idx) => {
                  const isActive = activeFrame === idx;
                  const isHov = hovThumb === idx;
                  return (
                    <VideoFrameThumbnail
                      key={frm.id}
                      frame={frm}
                      isActive={isActive}
                      isHov={isHov}
                      onSelect={() => setActiveFrame(idx)}
                      onMouseEnter={() => setHovThumb(idx)}
                      onMouseLeave={() => setHovThumb(null)}
                    />
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right: info panel */}
          <div style={{
            width: '280px', display: 'flex', flexDirection: 'column',
            height: `${modalH - 60}px`, flexShrink: 0,
            backgroundColor: '#161616', borderLeft: '1px solid #FFFFFF0F',
          }}>
            <div style={{ flexGrow: 1, flexShrink: 1, flexBasis: '0%', overflowY: 'auto', minHeight: 0 }}>
              {/* Finalized status */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px' }}>
                <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', letterSpacing: '0.01em', color: '#FFFFFF99' }}>是否定稿</span>
                {isFinalized ? (
                  <div style={{
                    paddingLeft: '4px', paddingRight: '4px', paddingTop: '2px', paddingBottom: '2px',
                    borderRadius: '2px', backgroundColor: '#4AC981',
                    boxShadow: '#FFFFFF14 0px 0px 0px 1px inset',
                    height: '18px',
                    display: 'flex',
                    alignItems: 'center',
                  }}>
                    <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '14px', color: '#0A0A0A', fontWeight: 500 }}>定稿</span>
                  </div>
                ) : (
                  <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', color: '#FFFFFF66' }}>否</span>
                )}
              </div>

              {/* Shot number — no divider above */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '16px', paddingBottom: '16px', paddingLeft: '20px', paddingRight: '20px', gap: '10px' }}>
                <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', letterSpacing: '0.01em', color: '#FFFFFF99' }}>分镜编号</span>
                <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', letterSpacing: '0.01em', color: '#FFFFFFCC' }}>{sn}</span>
              </div>

              <div style={{ height: '1px', backgroundColor: '#FFFFFF0A', marginLeft: '20px', marginRight: '20px' }} />

              {/* Creation mode — if refMode provided */}
              {refMode && (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', paddingTop: '16px', paddingBottom: '16px', paddingLeft: '20px', paddingRight: '20px', gap: '10px' }}>
                    <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '14px', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#FFFFFF99' }}>创作模式</span>
                    <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', letterSpacing: '0.01em', color: '#FFFFFFCC' }}>
                      {refMode === 'full_ref' ? '全能参考' : refMode === 'frame_ref' ? '首尾帧' : refMode}
                    </span>
                  </div>
                  <div style={{ height: '1px', backgroundColor: '#FFFFFF0A', marginLeft: '20px', marginRight: '20px' }} />
                </>
              )}

              {/* Reference items — show based on creation mode */}
              {refMode === 'full_ref' && (
                <>
                  {/* Ref subjects */}
                  {/* Ref images */}
                  {(refImages || []).length > 0 && (
                    <>
                      <div style={{ display: 'flex', flexDirection: 'column', paddingTop: '16px', paddingBottom: '16px', paddingLeft: '20px', paddingRight: '20px', gap: '10px' }}>
                        <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '14px', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#FFFFFF99' }}>参考图</span>
                        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', flex: 1, minWidth: 0 }}>
                          {refImages.map((ref, idx) => (
                            <div
                              key={idx}
                              style={{
                                borderRadius: '4px', overflow: 'hidden',
                                width: '80px', height: '56px', flexShrink: 0,
                                backgroundColor: '#FFFFFF14',
                                border: '1px solid #FFFFFF33',
                                backgroundImage: `url(${ref.url || ref})`,
                                backgroundSize: 'cover', backgroundPosition: '50%',
                              }}
                              title={ref.title}
                            />
                          ))}
                        </div>
                      </div>
                      <div style={{ height: '1px', backgroundColor: '#FFFFFF0A', marginLeft: '20px', marginRight: '20px' }} />
                    </>
                  )}
                  {/* Ref videos */}
                  {(refVideos || []).length > 0 && (
                    <>
                      <div style={{ display: 'flex', flexDirection: 'column', paddingTop: '16px', paddingBottom: '16px', paddingLeft: '20px', paddingRight: '20px', gap: '4px' }}>
                        <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '14px', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#FFFFFF99' }}>参考视频</span>
                        <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', letterSpacing: '0.01em', color: '#FFFFFFCC' }}>{(refVideos || []).length} 个</span>
                      </div>
                      <div style={{ height: '1px', backgroundColor: '#FFFFFF0A', marginLeft: '20px', marginRight: '20px' }} />
                    </>
                  )}
                </>
              )}

              {refMode === 'frame_ref' && (firstFrame || lastFrame) && (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', paddingTop: '16px', paddingBottom: '16px', paddingLeft: '20px', paddingRight: '20px', gap: '10px' }}>
                    <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '14px', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#FFFFFF99' }}>关键帧</span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {firstFrame && (
                        <div
                          style={{
                            borderRadius: '4px', overflow: 'hidden',
                            width: '60px', height: '42px', flexShrink: 0,
                            backgroundColor: '#FFFFFF14',
                            border: '1px solid #FFFFFF33',
                            backgroundImage: `url(${firstFrame})`,
                            backgroundSize: 'cover', backgroundPosition: '50%',
                          }}
                          title="首帧"
                        />
                      )}
                      {lastFrame && (
                        <div
                          style={{
                            borderRadius: '4px', overflow: 'hidden',
                            width: '60px', height: '42px', flexShrink: 0,
                            backgroundColor: '#FFFFFF14',
                            border: '1px solid #FFFFFF33',
                            backgroundImage: `url(${lastFrame})`,
                            backgroundSize: 'cover', backgroundPosition: '50%',
                          }}
                          title="尾帧"
                        />
                      )}
                    </div>
                  </div>
                  <div style={{ height: '1px', backgroundColor: '#FFFFFF0A', marginLeft: '20px', marginRight: '20px' }} />
                </>
              )}

              {/* AI Prompt */}
              {(prompt ?? MOCK_SHOT_VIDEO_DETAIL.prompt) && (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', paddingTop: '16px', paddingBottom: '16px', paddingLeft: '20px', paddingRight: '20px', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                      <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '14px', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#FFFFFF99' }}>AI 提示词</span>
                      <button
                        type="button"
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          width: '24px', height: '24px', borderRadius: '4px',
                          background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                          opacity: 0.6, transition: 'opacity 0.12s',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                        onMouseLeave={(e) => e.currentTarget.style.opacity = '0.6'}
                        onClick={() => {
                          navigator.clipboard.writeText(prompt ?? MOCK_SHOT_VIDEO_DETAIL.prompt);
                          showCopyToast();
                        }}
                        title="复制提示词"
                      >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
                          <path d="M4.33337 4.14383V2.60413C4.33337 2.08636 4.75311 1.66663 5.27087 1.66663H13.3959C13.9136 1.66663 14.3334 2.08636 14.3334 2.60413V10.7291C14.3334 11.2469 13.9136 11.6666 13.3959 11.6666H11.8388" stroke="white" strokeOpacity="0.6" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M10.7291 4.33337H2.60413C2.08636 4.33337 1.66663 4.75311 1.66663 5.27087V13.3959C1.66663 13.9136 2.08636 14.3334 2.60413 14.3334H10.7291C11.2469 14.3334 11.6666 13.9136 11.6666 13.3959V5.27087C11.6666 4.75311 11.2469 4.33337 10.7291 4.33337Z" stroke="white" strokeOpacity="0.6" strokeLinejoin="round"/>
                        </svg>
                      </button>
                    </div>
                    <p style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '20px', letterSpacing: '0.01em', color: '#FFFFFFCC', margin: 0 }}>{prompt ?? MOCK_SHOT_VIDEO_DETAIL.prompt}</p>
                  </div>
                  <div style={{ height: '1px', backgroundColor: '#FFFFFF0A', marginLeft: '20px', marginRight: '20px' }} />
                </>
              )}

              {/* Generation params */}
              <div style={{ display: 'flex', flexDirection: 'column', paddingTop: '16px', paddingBottom: '16px', paddingLeft: '20px', paddingRight: '20px', gap: '12px' }}>
                <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '14px', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#FFFFFF99' }}>生成参数</span>
                {[
                  { label: '模型', value: model ?? MOCK_SHOT_VIDEO_DETAIL.model },
                  { label: '分辨率', value: resolution ?? MOCK_SHOT_VIDEO_DETAIL.resolution },
                  { label: '时长', value: duration ?? MOCK_SHOT_VIDEO_DETAIL.duration },
                  { label: '比例', value: ratio ?? MOCK_SHOT_VIDEO_DETAIL.ratio },
                ].map(({ label, value }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', letterSpacing: '0.01em', color: '#FFFFFF99' }}>{label}</span>
                    <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', letterSpacing: '0.01em', color: '#FFFFFFCC' }}>{value}</span>
                  </div>
                ))}
              </div>

              <div style={{ height: '1px', backgroundColor: '#FFFFFF0A', marginLeft: '20px', marginRight: '20px' }} />

              {/* AI generated time */}
              <div style={{ display: 'flex', flexDirection: 'column', paddingTop: '16px', paddingBottom: '16px', paddingLeft: '20px', paddingRight: '20px', gap: '4px' }}>
                <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '14px', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#FFFFFF99' }}>AI 生成时间</span>
                <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', letterSpacing: '0.01em', color: '#FFFFFF66' }}>{generatedAt ?? MOCK_SHOT_VIDEO_DETAIL.generatedAt}</span>
              </div>
            </div>

            {/* Sticky buttons */}
            <div style={{ flexShrink: 0, paddingTop: '12px', paddingBottom: '20px', paddingLeft: '20px', paddingRight: '20px', borderTop: '1px solid #FFFFFF0A', display: 'flex', gap: '8px' }}>
              {onDelete && (
                <button
                  type="button"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flex: 1, height: '40px', borderRadius: '8px', gap: '8px',
                    backgroundColor: pressDelete ? '#FFFFFF26' : hovDelete ? '#FFFFFF1F' : '#FFFFFF14',
                    border: '1px solid #FFFFFF1F', cursor: 'pointer', transition: 'background-color 0.12s',
                    opacity: pressDelete ? 0.8 : 1,
                  }}
                  onMouseEnter={() => setHovDelete(true)}
                  onMouseLeave={() => { setHovDelete(false); setPressDelete(false); }}
                  onMouseDown={() => setPressDelete(true)}
                  onMouseUp={() => setPressDelete(false)}
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
                    <path d="M2.333 3.667V12.333C2.333 12.784 2.716 13.167 3.167 13.167H10.833C11.284 13.167 11.667 12.784 11.667 12.333V3.667" stroke="#FF6B6B" strokeLinejoin="round" />
                    <path d="M5.333 6V10.667" stroke="#FF6B6B" strokeLinecap="round" />
                    <path d="M8.667 6V10.667" stroke="#FF6B6B" strokeLinecap="round" />
                    <path d="M1 3.667H13" stroke="#FF6B6B" strokeLinecap="round" />
                    <path d="M4.333 3.667L5.15 1.333H8.85L9.667 3.667" stroke="#FF6B6B" strokeLinejoin="round" />
                  </svg>
                  <span style={{ fontFamily: FONT, fontSize: '13px', lineHeight: '16px', letterSpacing: '0.01em', color: '#FF6B6B' }}>删除</span>
                </button>
              )}
              <button
                type="button"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flex: 1, height: '40px', borderRadius: '8px', gap: '8px',
                  backgroundColor: hovDownload ? '#FFFFFF1F' : '#FFFFFF14',
                  border: '1px solid #FFFFFF1F', cursor: 'pointer', transition: 'background-color 0.12s',
                }}
                onMouseEnter={() => setHovDownload(true)}
                onMouseLeave={() => setHovDownload(false)}
                onClick={onDownload}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
                  <path d="M7 2V9M7 9L4 6.5M7 9L10 6.5M2 11H12" stroke="#FFFFFF99" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span style={{ fontFamily: FONT, fontSize: '13px', lineHeight: '16px', letterSpacing: '0.01em', color: '#FFFFFF99' }}>下载</span>
              </button>
            </div>

            {/* Delete confirmation */}
            {showDeleteConfirm && (
              <ConfirmDialog
                title="确定要删除吗？"
                description="删除后，该资产将被清除且不可恢复。"
                confirmText="删除"
                onCancel={() => setShowDeleteConfirm(false)}
                onConfirm={() => { setShowDeleteConfirm(false); onShowToast?.('删除成功', 'success'); onDelete?.(); }}
                zIndex={300}
              />
            )}
          </div>
        </div>
      </div>
      {copyToast && createPortal(
        <div style={{ position: 'fixed', top: '25vh', left: '50%', transform: 'translateX(-50%)', zIndex: 9999, pointerEvents: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '8px', background: 'rgba(30,30,30,0.92)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.1)', whiteSpace: 'nowrap' }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}><path d="M8 14.667C11.682 14.667 14.667 11.682 14.667 8C14.667 4.318 11.682 1.333 8 1.333C4.318 1.333 1.333 4.318 1.333 8C1.333 11.682 4.318 14.667 8 14.667Z" fill="#52BF92" stroke="#52BF92" strokeWidth="1.333" strokeLinejoin="round"/><path d="M5.333 8L7.333 10L11.333 6" stroke="#FFFFFF" strokeWidth="1.333" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <span style={{ fontSize: '14px', color: '#FFFFFF', fontFamily: "'AlibabaPuHuiTi_2_55_Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif" }}>提示词复制成功</span>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

function AssetCard({ name, bgColor = '#252525', url = null, starred = false, selected = false, batchMode = false, showStar = false, assetType = 'asset', onDownload, onDelete, onStar, onSelect, asset = {} }) {
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

const SUBJECT_CARD_CATEGORIES = new Set(['chars', 'scenes', 'props', 'storyboard_img', 'storyboard_video']);

function ProjectAssetCard({ name, desc, url, selected, batchMode, onDownload, onDelete, onSelect, onShowToast, asset = {}, category = '' }) {
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

      {/* 主体资产多图聚合详情弹窗（角色/场景/道具） */}
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

      {/* 兼容旧逻辑：若无 images 则用原 ImageDetailModal */}
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

function BatchActionBtn({ children, onClick }) {
  return (
    <GhostButton onClick={onClick}>
      <span style={{ fontFamily: FONT, fontSize: '14px', color: 'rgba(255,255,255,0.8)', whiteSpace: 'nowrap' }}>
        {children}
      </span>
    </GhostButton>
  );
}

function TabBar({ tabs, active, onChange }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'baseline',
      gap: '24px',
      paddingTop: '16px',
      paddingLeft: '24px',
      paddingRight: '24px',
      height: '48px',
    }}>
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        return (
          <button
            key={tab.key}
            type="button"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              fontFamily: isActive ? FONT_MEDIUM : FONT,
              fontSize: '14px',
              lineHeight: '18px',
              color: isActive ? '#FFFFFF' : '#FFFFFF99',
              transition: 'color 0.12s',
            }}
            onClick={() => onChange(tab.key)}
          >
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function ModuleTabBar({ tabs, active, onChange }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-end',
      paddingLeft: '24px',
      paddingRight: '24px',
      gap: '24px',
      borderBottom: '1px solid #FFFFFF14',
    }}>
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        return (
          <button
            key={tab.key}
            type="button"
            style={{
              background: 'none',
              border: 'none',
              borderBottom: '2px solid transparent',
              paddingTop: '12px',
              paddingBottom: '6px',
              cursor: 'pointer',
              fontFamily: isActive ? FONT_MEDIUM : FONT,
              fontSize: '16px',
              color: isActive ? '#2DC3E1' : '#FFFFFF99',
              transition: 'color 0.12s',
            }}
            onClick={() => onChange(tab.key)}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

const MOCK_PROJECTS = [
  { id: 'p1', name: '星际迷途', count: 24 },
  { id: 'p2', name: '暗夜追踪', count: 18 },
  { id: 'p3', name: '光影之间', count: 31 },
  { id: 'p4', name: '未来边界', count: 9 },
];

const PROJECT_CATEGORY_TABS = [
  { key: 'chars', label: '角色' },
  { key: 'scenes', label: '场景' },
  { key: 'props', label: '道具' },
  { key: 'storyboard_img', label: '分镜图' },
  { key: 'storyboard_video', label: '分镜视频' },
  { key: 'audio', label: '音频' },
  { key: 'final', label: '成片' },
];

const CREATIVE_TYPE_TABS = [
  { key: 'image', label: '图片' },
  { key: 'video', label: '视频' },
  { key: 'dubbing', label: '配音' },
];


const MOCK_PROJECT_ASSETS = {
  chars: [
    { id: 'c1', name: '老虎主角', starred: true, bgColor: '#252525' },
    { id: 'c2', name: '老虎姈姈', starred: false, bgColor: '#1F2320' },
    { id: 'c3', name: '老虎弟弟', starred: false, bgColor: '#20201F' },
    { id: 'c4', name: '老虎妹妹', starred: false, bgColor: '#202024' },
    { id: 'c5', name: '小老虎 A', starred: false, bgColor: '#1F2020' },
    { id: 'c6', name: '反派狼', starred: false, bgColor: '#1D2020' },
    { id: 'c7', name: '猎人爷爷', starred: false, bgColor: '#21201D' },
    { id: 'c8', name: '神秘猫咪', starred: false, bgColor: '#1E1E22' },
  ],
  scenes: [
    { id: 's1', name: '森林入口', starred: false, bgColor: '#1A2018' },
    { id: 's2', name: '老虎洞穴', starred: true, bgColor: '#1E2020' },
    { id: 's3', name: '山顶瞭望台', starred: false, bgColor: '#1C1E1A' },
    { id: 's4', name: '村庄广场', starred: false, bgColor: '#201E1A' },
  ],
  props: [
    { id: 'p1', name: '猎人陷阱', starred: false, bgColor: '#201E1A' },
    { id: 'p2', name: '老虎项圈', starred: true, bgColor: '#1E1E22' },
    { id: 'p3', name: '神秘宝箱', starred: false, bgColor: '#1A1E20' },
  ],
  storyboard_img: [
    { id: 'si1', name: '第1集_镜头01', starred: false, bgColor: '#1E2022' },
    { id: 'si2', name: '第1集_镜头02', starred: false, bgColor: '#201E22' },
    { id: 'si3', name: '第1集_镜头03', starred: true, bgColor: '#1E2020' },
    { id: 'si4', name: '第2集_镜头01', starred: false, bgColor: '#22201E' },
    { id: 'si5', name: '第2集_镜头02', starred: false, bgColor: '#1E2220' },
  ],
  storyboard_video: [
    { id: 'sv1', name: '第1集_预览', starred: false, bgColor: '#1A1E24' },
    { id: 'sv2', name: '第2集_预览', starred: false, bgColor: '#1E1A24' },
  ],
  audio: [
    { id: 'au1', name: '主题曲_片头', starred: true, duration: '2:34' },
    { id: 'au2', name: '背景音乐_森林', starred: false, duration: '4:12' },
    { id: 'au3', name: '音效_老虎吼叫', starred: false, duration: '0:08' },
  ],
  final: [
    { id: 'f1', name: '第1集_成片', starred: true, bgColor: '#1A1E22' },
    { id: 'f2', name: '第2集_成片', starred: false, bgColor: '#1E1A22' },
  ],
};

function FavFilterCheckbox({ checked, onChange }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
      <div
        style={{
          width: '16px',
          height: '16px',
          borderRadius: '4px',
          border: checked ? '1px solid #2DC3E1' : '1px solid rgba(255,255,255,0.3)',
          backgroundColor: checked ? '#2DC3E1' : 'transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          transition: 'all 0.12s',
        }}
        onClick={onChange}
      >
        {checked && (
          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
            <path d="M1 4L3.5 6.5L9 1" stroke="#000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
      <span style={{ fontFamily: FONT, fontSize: '14px', color: 'rgba(255,255,255,0.6)' }}>只看收藏</span>
    </label>
  );
}

function ProjectListItem({ project, active, onClick }) {
  const [hov, setHov] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [hovIdx, setHovIdx] = useState(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onDown(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [menuOpen]);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        width: '100%',
        paddingTop: '10px',
        paddingBottom: '10px',
        paddingLeft: '12px',
        paddingRight: '12px',
        borderRadius: '8px',
        backgroundColor: active ? '#FFFFFF0F' : hov ? '#FFFFFF08' : 'transparent',
        cursor: 'pointer',
        transition: 'background-color 0.12s',
        position: 'relative',
      }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => { setHov(false); setMenuOpen(false); }}
    >
      <button
        type="button"
        style={{
          flex: 1,
          background: 'none',
          border: 'none',
          padding: 0,
          textAlign: 'left',
          cursor: 'pointer',
          minWidth: 0,
        }}
        onClick={onClick}
      >
        <span style={{
          display: 'block',
          fontFamily: active ? FONT_MEDIUM : FONT,
          fontWeight: active ? 500 : 400,
          fontSize: '14px',
          color: active ? '#FFFFFF' : '#FFFFFF99',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>{project.name}</span>
      </button>

      {/* hover more button */}
      <div ref={menuRef} style={{ position: 'relative', flexShrink: 0 }}>
        {hov && (
          <button
            type="button"
            style={{
              position: 'absolute',
              top: '50%',
              right: 0,
              transform: 'translateY(-50%)',
              width: '24px',
              height: '24px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: menuOpen ? 'rgba(255,255,255,0.15)' : '#00000080',
              border: 'none',
              cursor: 'pointer',
              transition: 'background-color 0.12s',
              flexShrink: 0,
            }}
            onMouseEnter={(e) => { if (!menuOpen) e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.65)'; }}
            onMouseLeave={(e) => { if (!menuOpen) e.currentTarget.style.backgroundColor = '#00000080'; }}
            onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
            aria-label="更多操作"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
              <circle cx="8" cy="4" r="1.2" fill="#fff" />
              <circle cx="8" cy="8" r="1.2" fill="#fff" />
              <circle cx="8" cy="12" r="1.2" fill="#fff" />
            </svg>
          </button>
        )}
        {menuOpen && (
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 4px)',
              right: 0,
              zIndex: 50,
              minWidth: '110px',
              padding: '4px',
              borderRadius: '8px',
              backgroundColor: '#1C1C1C',
              border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0px 4px 16px rgba(0,0,0,0.5)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {[
              { label: '重命名', icon: (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                  <path d="M11 2L14 5L5 14H2V11L11 2Z" stroke="rgba(255,255,255,0.8)" strokeLinejoin="round" />
                  <path d="M10 3L13 6" stroke="rgba(255,255,255,0.8)" />
                </svg>
              ), action: () => { setMenuOpen(false); project.onRename?.(); }, danger: false },
              { label: '删除', icon: <TrashIcon color="#F75F5F" />, action: () => { setMenuOpen(false); project.onDelete?.(); }, danger: true },
              { label: '下载项目', icon: <DownloadIcon color="rgba(255,255,255,0.8)" />, action: () => { setMenuOpen(false); project.onDownload?.(); }, danger: false },
            ].map((item, i) => (
              <button
                key={item.label}
                type="button"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  border: 'none',
                  background: hovIdx === i ? 'rgba(255,255,255,0.08)' : 'transparent',
                  cursor: 'pointer',
                  fontFamily: FONT,
                  fontSize: '14px',
                  lineHeight: '18px',
                  color: item.danger ? '#F75F5F' : 'rgba(255,255,255,0.8)',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={() => setHovIdx(i)}
                onMouseLeave={() => setHovIdx(null)}
                onClick={item.action}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// 图片空状态 — 面性风景图占位
function EmptyIconImage() {
  return (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="10" y="14" width="60" height="46" rx="7" fill="rgba(255,255,255,0.06)" />
      <rect x="10" y="14" width="60" height="22" rx="7" fill="rgba(255,255,255,0.04)" />
      <circle cx="26" cy="27" r="8" fill="rgba(255,255,255,0.10)" />
      <circle cx="26" cy="27" r="5" fill="rgba(255,255,255,0.18)" />
      <path d="M10 48 L24 30 L36 42 L48 28 L60 40 L70 32 L70 60 L10 60 Z" fill="rgba(255,255,255,0.07)" />
      <path d="M10 60 L10 52 L22 38 L34 50 L44 38 L58 52 L70 44 L70 60 Z" fill="rgba(255,255,255,0.13)" />
      <rect x="10" y="14" width="60" height="46" rx="7" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
    </svg>
  );
}

// 视频空状态 — 面性播放器占位
function EmptyIconVideo() {
  return (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="8" y="18" width="52" height="38" rx="7" fill="rgba(255,255,255,0.08)" />
      <rect x="8" y="18" width="52" height="9" rx="4" fill="rgba(0,0,0,0.2)" />
      <circle cx="34" cy="42" r="12" fill="rgba(255,255,255,0.13)" />
      <path d="M30.5 36.5 L30.5 47.5 L42 42 Z" fill="rgba(255,255,255,0.5)" />
      <rect x="64" y="18" width="12" height="12" rx="4" fill="rgba(255,255,255,0.11)" />
      <rect x="64" y="33" width="12" height="12" rx="4" fill="rgba(255,255,255,0.07)" />
      <rect x="64" y="48" width="12" height="8" rx="4" fill="rgba(255,255,255,0.04)" />
      <rect x="8" y="58" width="52" height="3" rx="1.5" fill="rgba(255,255,255,0.07)" />
      <rect x="8" y="58" width="20" height="3" rx="1.5" fill="rgba(255,255,255,0.22)" />
      <circle cx="28" cy="59.5" r="3.5" fill="rgba(255,255,255,0.4)" />
    </svg>
  );
}

// 音频空状态 — 面性音波占位
function EmptyIconAudio() {
  return (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="40" cy="40" r="28" fill="rgba(255,255,255,0.06)" />
      <circle cx="40" cy="40" r="18" fill="rgba(255,255,255,0.05)" />
      <rect x="14" y="34" width="3" height="12" rx="1.5" fill="rgba(255,255,255,0.12)" />
      <rect x="19" y="30" width="3" height="20" rx="1.5" fill="rgba(255,255,255,0.18)" />
      <rect x="24" y="26" width="3" height="28" rx="1.5" fill="rgba(255,255,255,0.22)" />
      <rect x="29" y="30" width="3" height="20" rx="1.5" fill="rgba(255,255,255,0.28)" />
      <rect x="34" y="33" width="3" height="14" rx="1.5" fill="rgba(255,255,255,0.32)" />
      <circle cx="40" cy="40" r="5" fill="rgba(255,255,255,0.28)" />
      <circle cx="40" cy="40" r="2.5" fill="rgba(255,255,255,0.5)" />
      <rect x="43" y="33" width="3" height="14" rx="1.5" fill="rgba(255,255,255,0.32)" />
      <rect x="48" y="30" width="3" height="20" rx="1.5" fill="rgba(255,255,255,0.28)" />
      <rect x="53" y="26" width="3" height="28" rx="1.5" fill="rgba(255,255,255,0.22)" />
      <rect x="58" y="30" width="3" height="20" rx="1.5" fill="rgba(255,255,255,0.18)" />
      <rect x="63" y="34" width="3" height="12" rx="1.5" fill="rgba(255,255,255,0.12)" />
    </svg>
  );
}

// 根据 mediaType 选图标
function EmptyAssetState({ mediaType = 'image' }) {
  let Icon;
  if (mediaType === 'video') Icon = EmptyIconVideo;
  else if (mediaType === 'audio') Icon = EmptyIconAudio;
  else Icon = EmptyIconImage;

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Icon />
    </div>
  );
}

// category → mediaType 映射
function categoryToMediaType(category) {
  if (category === 'storyboard_video' || category === 'final') return 'video';
  if (category === 'audio') return 'audio';
  return 'image';
}

function EmptyProjectAssets({ category }) {
  return <EmptyAssetState mediaType={categoryToMediaType(category)} />;
}

function EmptyCreativeAssets({ type }) {
  const mediaType = type === 'dubbing' ? 'audio' : type;
  return <EmptyAssetState mediaType={mediaType} />;
}

function notifyProjectAssetsDeleted(projectId) {
  if (!projectId) return;
  window.dispatchEvent(new CustomEvent('project-assets:deleted', { detail: { projectId } }));
}

function ProjectAssetsPanel() {
  const [projects, setProjects] = useState([]);
  const [activeProject, setActiveProject] = useState(null);
  const [activeCategory, setActiveCategory] = useState('chars');
  const [batchMode, setBatchMode] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [favOnly, setFavOnly] = useState(false);
  const [assetsMap, setAssetsMap] = useState({});
  // 每个 [projectId+category] 的分页状态：{ cursor, hasMore, loading, rawList }
  const [pageMeta, setPageMeta] = useState({});
  const sentinelRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const [renameTarget, setRenameTarget] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [batchDeleteConfirm, setBatchDeleteConfirm] = useState(false);
  const [toast, setToast] = useState(null);

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  }

  const pageKey = (projectId, category) => `${projectId}__${category}`;

  // 首屏加载：切换项目或 tab 时触发
  async function loadFirstPage(projectId, category) {
    const key = pageKey(projectId, category);
    // 清掉旧非分页接口写入的 localStorage 缓存，防止过期分组数据覆盖新结果
    invalidate(K.projectAssets(projectId), 'local');
    setPageMeta(prev => ({ ...prev, [key]: { cursor: null, hasMore: false, loading: true, rawList: [] } }));
    try {
      const limit = calcProjectAssetsLimit(category);
      const result = await apiGetProjectAssetsPage(projectId, { category, limit });
      setAssetsMap(prev => ({ ...prev, [category]: result.grouped[category] ?? [] }));
      setPageMeta(prev => ({
        ...prev,
        [key]: { cursor: result.nextCursor, hasMore: result.hasMore, loading: false, rawList: result.rawList },
      }));
    } catch (err) {
      console.error('[ProjectAssetsPanel] 加载失败:', err);
      setPageMeta(prev => ({ ...prev, [key]: { cursor: null, hasMore: false, loading: false, rawList: [] } }));
    }
  }

  // 加载更多
  async function loadMorePage(projectId, category) {
    const key = pageKey(projectId, category);
    const meta = pageMeta[key];
    if (!meta || meta.loading || !meta.hasMore) return;
    setPageMeta(prev => ({ ...prev, [key]: { ...prev[key], loading: true } }));
    try {
      const limit = calcProjectAssetsLimit(category);
      const result = await apiGetProjectAssetsPage(projectId, { category, limit, cursor: meta.cursor });
      const accumulated = [...(meta.rawList || []), ...result.rawList];
      const regrouped = groupByCategory(accumulated);
      setAssetsMap(prev => ({ ...prev, [category]: regrouped[category] ?? [] }));
      setPageMeta(prev => ({
        ...prev,
        [key]: { cursor: result.nextCursor, hasMore: result.hasMore, loading: false, rawList: accumulated },
      }));
    } catch (err) {
      console.error('[ProjectAssetsPanel] 加载更多失败:', err);
      setPageMeta(prev => ({ ...prev, [key]: { ...prev[key], loading: false } }));
    }
  }

  useEffect(() => {
    apiGetProjects().then((list) => {
      setProjects(list);
      setActiveProject((prev) => prev ?? list[0]?.id ?? null);
    });
  }, []);

  // 项目或 tab 切换时加载首屏
  useEffect(() => {
    if (activeProject == null) return;
    loadFirstPage(activeProject, activeCategory);
  }, [activeProject, activeCategory]);

  // IntersectionObserver 触底加载更多
  useEffect(() => {
    if (!sentinelRef.current || !scrollContainerRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && activeProject) {
          loadMorePage(activeProject, activeCategory);
        }
      },
      { root: scrollContainerRef.current, rootMargin: '120px', threshold: 0 }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [activeProject, activeCategory, pageMeta]);

  const categoryAssets = assetsMap[activeCategory] || [];
  const filtered = favOnly ? categoryAssets.filter((a) => a.starred) : categoryAssets;

  function toggleStar(id) {
    const current = assetsMap[activeCategory]?.find((a) => a.id === id);
    const newStarred = !current?.starred;
    apiUpdateAsset(id, { is_starred: newStarred }).catch(console.error);
    setAssetsMap((prev) => ({
      ...prev,
      [activeCategory]: prev[activeCategory].map((a) => a.id === id ? { ...a, starred: newStarred } : a),
    }));
  }

  async function deleteAsset(id, singleImageId = null) {
    // singleImageId 存在时表示删除单张图，否则删除整个主体
    const SUBJECT_TYPE_MAP = { chars: 'character', scenes: 'scene', props: 'prop' };
    const isSubjectCategory = !!SUBJECT_TYPE_MAP[activeCategory];
    try {
      if (singleImageId) {
        await apiDeleteAsset(singleImageId, { projectId: activeProject });
        const targetAsset = assetsMap[activeCategory]?.find((a) => a.id === id);
        const remainingImages = (targetAsset?.images || []).filter((img) => img.id !== singleImageId);
        if (isSubjectCategory && remainingImages.length === 0 && targetAsset?.subject_id) {
          // 最后一张图删掉 → 删除主体实体本身
          await apiDeleteSubject(activeProject, targetAsset.subject_id).catch(() => {});
        }
        setAssetsMap((prev) => ({
          ...prev,
          [activeCategory]: prev[activeCategory].map((asset) => {
            if (asset.id === id && asset.images) {
              const filtered = asset.images.filter((img) => img.id !== singleImageId);
              if (filtered.length === 0) {
                return null;
              }
              return {
                ...asset,
                images: filtered,
                imageCount: filtered.length,
                url: filtered[0]?.url || asset.url,
              };
            }
            return asset;
          }).filter(Boolean),
        }));
        // 触发主体页面更新：删除图后重新拉取该类型主体，notify 会推给 SubjectPage 的 subscribe
        const subjectType = SUBJECT_TYPE_MAP[activeCategory];
        if (subjectType && activeProject) {
          apiGetSubjects(activeProject, { type: subjectType }).catch(() => {});
        }
      } else {
        const asset = assetsMap[activeCategory]?.find((a) => a.id === id);
        if (asset && asset.images) {
          await apiBatchDeleteAssets(asset.images.map((img) => img.id), { projectId: activeProject });
        } else {
          await apiDeleteAsset(id, { projectId: activeProject });
        }
        // 删除全部图片后，同步删除主体实体
        if (isSubjectCategory && asset?.subject_id) {
          await apiDeleteSubject(activeProject, asset.subject_id).catch(() => {});
        }
        setAssetsMap((prev) => ({
          ...prev,
          [activeCategory]: prev[activeCategory].filter((a) => a.id !== id),
        }));
        // 整个主体删除也同步更新
        const subjectType = SUBJECT_TYPE_MAP[activeCategory];
        if (subjectType && activeProject) {
          apiGetSubjects(activeProject, { type: subjectType }).catch(() => {});
        }
      }
      notifyProjectAssetsDeleted(activeProject);
    } catch (err) {
      console.error('删除资产失败', err);
    }
  }

  async function deleteSelected() {
    const ids = [...selected];
    const SUBJECT_TYPE_MAP = { chars: 'character', scenes: 'scene', props: 'prop' };
    const isSubjectCategory = !!SUBJECT_TYPE_MAP[activeCategory];
    try {
      // 对于主体卡片（chars/scenes/props），需要删除该主体下的所有图片
      if (SUBJECT_CARD_CATEGORIES.has(activeCategory)) {
        const allImageIds = [];
        const subjectIds = [];
        ids.forEach((cardId) => {
          const card = assetsMap[activeCategory]?.find((a) => a.id === cardId);
          if (card && card.images) {
            allImageIds.push(...card.images.map((img) => img.id));
          } else {
            allImageIds.push(cardId);
          }
          if (isSubjectCategory && card?.subject_id) subjectIds.push(card.subject_id);
        });
        await apiBatchDeleteAssets(allImageIds, { projectId: activeProject });
        // 同步删除主体实体
        for (const subjectId of subjectIds) {
          await apiDeleteSubject(activeProject, subjectId).catch(() => {});
        }
        const subjectType = SUBJECT_TYPE_MAP[activeCategory];
        if (subjectType && activeProject) {
          apiGetSubjects(activeProject, { type: subjectType }).catch(() => {});
        }
      } else {
        await apiBatchDeleteAssets(ids, { projectId: activeProject });
      }

      setAssetsMap((prev) => ({
        ...prev,
        [activeCategory]: prev[activeCategory].filter((a) => !selected.has(a.id)),
      }));
      setSelected(new Set());
      notifyProjectAssetsDeleted(activeProject);
    } catch (err) {
      console.error('批量删除资产失败', err);
    }
  }

  function toggleSelect(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function selectAll() {
    const allIds = filtered.map((a) => a.id);
    const isAllSelected = allIds.length > 0 && allIds.every((id) => selected.has(id));
    setSelected(isAllSelected ? new Set() : new Set(allIds));
  }

  function exitBatch() {
    setBatchMode(false);
    setSelected(new Set());
  }

  function handleRenameProject(project) {
    setRenameTarget(project);
    setRenameValue(project.name);
  }

  function confirmRename() {
    if (!renameTarget || !renameValue.trim()) return;
    apiUpdateProject(renameTarget.id, { name: renameValue.trim() }).then(() => {
      setProjects((prev) => prev.map((p) => p.id === renameTarget.id ? { ...p, name: renameValue.trim() } : p));
      setRenameTarget(null);
    }).catch(console.error);
  }

  function handleDeleteProject(project) {
    setDeleteTarget(project);
  }

  function confirmDeleteProject() {
    if (!deleteTarget) return;
    apiDeleteProject(deleteTarget.id).then(() => {
      setProjects((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      if (activeProject === deleteTarget.id) {
        setActiveProject(null);
        setAssetsMap({});
      }
      setDeleteTarget(null);
    }).catch(console.error);
  }

  function handleDownloadProject(project) {
    apiDownloadProjectAssets(project.id).catch(console.error);
  }

  async function downloadAsset(assetId, assetName) {
    try {
      const blob = await apiDownloadAsset(assetId, { prefer_origin: true });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = assetName || 'asset';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('下载失败', err);
    }
  }

  function getSelectedDownloadItems() {
    const selectedIds = [...selected];
    const items = [];

    selectedIds.forEach((cardId) => {
      const card = assetsMap[activeCategory]?.find((asset) => asset.id === cardId);
      if (!card) return;

      if (Array.isArray(card.images) && card.images.length > 0) {
        card.images.forEach((image, index) => {
          items.push({
            id: image.id,
            name: card.images.length > 1 ? `${card.name || 'asset'}-${index + 1}` : (card.name || 'asset'),
          });
        });
        return;
      }

      items.push({
        id: card.id,
        name: card.name || 'asset',
      });
    });

    return items;
  }

  async function downloadSelected() {
    const items = getSelectedDownloadItems();
    if (items.length === 0) return;

    for (const item of items) {
      await downloadAsset(item.id, item.name);
    }
  }

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      <div style={{
        width: '220px',
        flexShrink: 0,
        paddingTop: '16px',
        paddingBottom: '16px',
        paddingLeft: '12px',
        paddingRight: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        borderRight: '1px solid #FFFFFF14',
        overflowY: 'auto',
      }}>
        <div style={{
          padding: '4px 8px 8px 8px',
          fontFamily: FONT,
          fontSize: '14px',
          color: '#FFFFFF99',
          letterSpacing: '0.02em',
        }}>项目列表</div>
        {projects.map((p) => (
          <ProjectListItem
            key={p.id}
            project={{ ...p, onRename: () => handleRenameProject(p), onDelete: () => handleDeleteProject(p), onDownload: () => handleDownloadProject(p) }}
            active={activeProject === p.id}
            onClick={() => { setActiveProject(p.id); exitBatch(); }}
          />
        ))}
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <TabBar tabs={PROJECT_CATEGORY_TABS} active={activeCategory} onChange={(k) => {
            setActiveCategory(k);
            setFavOnly(false);
            exitBatch();
            // useEffect([activeProject, activeCategory]) 会自动触发首屏加载
          }} />
          {batchMode ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingLeft: '24px', paddingRight: '24px', gap: '8px', flex: 1, height: '48px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontFamily: FONT, fontSize: '14px', color: '#FFFFFF99' }}>已选 {selected.size} 项</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <GhostBtn onClick={selectAll}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                    <path d="M14 6.667V13C14 13.552 13.552 14 13 14H3C2.448 14 2 13.552 2 13V3C2 2.448 2.448 2 3 2H10" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M5.333 6.667L8.667 9.333L13.667 2.333" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span style={{ fontFamily: FONT, fontSize: '14px', color: '#FFFFFF', whiteSpace: 'nowrap' }}>全选</span>
                </GhostBtn>
                <GhostBtn onClick={downloadSelected}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, rotate: '180deg', transformOrigin: '50% 50%' }}>
                    <path d="M8.003 4.7V14" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M4 8.667L8 4.667L12 8.667" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M4 2H12" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span style={{ fontFamily: FONT, fontSize: '14px', color: '#FFFFFF', whiteSpace: 'nowrap' }}>下载</span>
                </GhostBtn>
                <PlainBtn onClick={() => setBatchDeleteConfirm(true)} danger>
                  <TrashIcon color="#F75F5F" />
                  <span style={{ fontFamily: FONT, fontSize: '14px', color: '#F75F5F', whiteSpace: 'nowrap' }}>删除</span>
                </PlainBtn>
                <PlainBtn onClick={exitBatch}>
                  <span style={{ fontFamily: FONT, fontSize: '14px', color: '#FFFFFFCC', whiteSpace: 'nowrap' }}>取消</span>
                </PlainBtn>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingLeft: '24px', paddingRight: '24px', height: '48px', flexShrink: 0 }}>
              <GhostBtn onClick={() => setBatchMode(true)}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                  <path d="M11.333 1.667H2.667C2.114 1.667 1.667 2.114 1.667 2.667V11.333C1.667 11.886 2.114 12.333 2.667 12.333H11.333C11.886 12.333 12.333 11.886 12.333 11.333V2.667C12.333 2.114 11.886 1.667 11.333 1.667Z" stroke="#FFFFFF" strokeLinejoin="round" />
                  <path d="M14.667 4.334V14C14.667 14.368 14.368 14.667 14 14.667H4.334" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M4.333 6.829L6.333 8.67L9.667 5.24" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span style={{ fontFamily: FONT, fontSize: '14px', color: '#FFFFFF', whiteSpace: 'nowrap' }}>批量操作</span>
              </GhostBtn>
            </div>
          )}
        </div>

        <div ref={scrollContainerRef} style={{
          flex: 1,
          overflowY: 'auto',
          paddingTop: '16px',
          paddingBottom: '24px',
          paddingLeft: '24px',
          paddingRight: '24px',
          ...(filtered.length === 0 ? {
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          } : activeCategory === 'audio' ? {
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          } : {
            display: 'grid',
            gridTemplateColumns: SUBJECT_CARD_CATEGORIES.has(activeCategory) && !['storyboard_img', 'storyboard_video'].includes(activeCategory)
              ? 'repeat(auto-fill, minmax(160px, 1fr))'
              : 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: '8px',
            alignContent: 'flex-start',
          }),
        }}>
          {filtered.length === 0 ? (
            <EmptyProjectAssets category={activeCategory} />
          ) : filtered.map((asset) => (
            activeCategory === 'audio' ? (
              <AudioCard
                key={asset.id}
                name={asset.name}
                duration={asset.duration}
                starred={asset.starred}
                selected={batchMode && selected.has(asset.id)}
                batchMode={batchMode}
                onSelect={() => toggleSelect(asset.id)}
                onStar={() => toggleStar(asset.id)}
                onDownload={() => downloadAsset(asset.id, asset.name)}
                onDelete={() => deleteAsset(asset.id)}
              />
            ) : SUBJECT_CARD_CATEGORIES.has(activeCategory) ? (
              <ProjectAssetCard
                key={asset.id}
                name={asset.name}
                desc={asset.description}
                url={asset.url || null}
                selected={batchMode && selected.has(asset.id)}
                batchMode={batchMode}
                onSelect={() => toggleSelect(asset.id)}
                onDownload={() => downloadAsset(asset.id, asset.name)}
                onDelete={(imageId) => deleteAsset(asset.id, imageId)}
                onShowToast={showToast}
                asset={asset}
                category={activeCategory}
              />
            ) : (
              <AssetCard
                key={asset.id}
                name={asset.name}
                bgColor={asset.bgColor || '#252525'}
                url={asset.url || null}
                starred={asset.starred}
                selected={batchMode && selected.has(asset.id)}
                batchMode={batchMode}
                assetType={activeCategory === 'storyboard_img' ? 'shot' : activeCategory === 'storyboard_video' ? 'shot_video' : 'asset'}
                onSelect={() => toggleSelect(asset.id)}
                onStar={() => toggleStar(asset.id)}
                onDownload={() => downloadAsset(asset.id, asset.name)}
                onDelete={() => deleteAsset(asset.id)}
                asset={asset}
              />
            )
          ))}
          {/* 滚动加载哨兵 */}
          <div ref={sentinelRef} style={{ width: '100%', height: '1px', flexShrink: 0 }} />
          {pageMeta[pageKey(activeProject, activeCategory)]?.loading && (
            <div style={{ width: '100%', display: 'flex', justifyContent: 'center', padding: '16px 0', flexShrink: 0 }}>
              <span style={{ fontFamily: FONT, fontSize: '13px', color: '#FFFFFF40' }}>加载中…</span>
            </div>
          )}
        </div>
      </div>

      {/* Rename Modal — matches ProjectList RenameModal */}
      {renameTarget && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
          }}
          onClick={() => setRenameTarget(null)}
        >
          <div
            style={{
              width: '400px',
              background: '#161616',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '16px',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 24px',
                background: '#161616',
              }}
            >
              <span style={{ fontFamily: FONT_MEDIUM, fontWeight: 500, fontSize: '16px', lineHeight: '20px', color: '#FFFFFF' }}>
                重命名
              </span>
              <button
                type="button"
                onClick={() => setRenameTarget(null)}
                style={{
                  width: '28px',
                  height: '28px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  borderRadius: '6px',
                  padding: 0,
                }}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M2.667 2.667L13.333 13.333" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M2.667 13.333L13.333 2.667" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>

            <div style={{ padding: '8px 24px', background: '#161616' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: 'rgba(255,255,255,0.6)' }}>
                  项目名称
                </span>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    height: '36px',
                    paddingLeft: '12px',
                    paddingRight: '6px',
                    borderRadius: '8px',
                    background: '#1D1E1E',
                    border: '1px solid rgba(255,255,255,0.08)',
                    outline: '1px solid #00000080',
                    outlineOffset: '0',
                  }}
                >
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') confirmRename(); if (e.key === 'Escape') setRenameTarget(null); }}
                    style={{
                      flex: 1,
                      background: 'transparent',
                      border: 'none',
                      outline: 'none',
                      fontFamily: FONT,
                      fontSize: '14px',
                      lineHeight: '18px',
                      color: '#FFFFFF',
                      caretColor: '#2DC3E1',
                    }}
                  />
                </div>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: '8px',
                padding: '16px 24px',
                background: '#161616',
              }}
            >
              <button
                type="button"
                onClick={() => setRenameTarget(null)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  height: '36px',
                  flexShrink: 0,
                  borderRadius: '8px',
                  padding: '0 16px',
                  gap: '4px',
                  boxShadow: 'rgba(0,0,0,0.4) 3px 3px 8px',
                  background: '#161616',
                  border: '1px solid rgba(255,255,255,0.05)',
                  outline: '1px solid #00000080',
                  cursor: 'pointer',
                  fontFamily: FONT,
                  fontSize: '14px',
                  lineHeight: '18px',
                  color: 'rgba(255,255,255,0.6)',
                }}
              >
                取消
              </button>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  height: '36px',
                  flexShrink: 0,
                  borderRadius: '8px',
                  boxShadow: 'rgba(0,0,0,0.4) 3px 3px 8px',
                  outline: '1px solid #00000080',
                  padding: '1px',
                  backgroundImage: !renameValue.trim()
                    ? 'linear-gradient(in oklab 180deg, #FFFFFF14, #FFFFFF14)'
                    : 'linear-gradient(in oklab 148.76deg, oklab(94.7% -0.078 -0.022 / 30%) 3.64%, oklab(75.5% -0.102 -0.072 / 0%) 42.81%), linear-gradient(in oklab 180deg, #FFFFFF14, #FFFFFF14)',
                  opacity: !renameValue.trim() ? 0.5 : 1,
                  cursor: !renameValue.trim() ? 'not-allowed' : 'pointer',
                }}
                onClick={renameValue.trim() ? confirmRename : undefined}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    flexGrow: 1,
                    borderRadius: '7px',
                    padding: '0 15px',
                    gap: '4px',
                    background: '#161616',
                  }}
                >
                  <span style={{ fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: '#FFFFFF', whiteSpace: 'nowrap' }}>
                    确认
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal — matches ProjectList DeleteProjectDialog */}
      {deleteTarget && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
          }}
          onClick={() => setDeleteTarget(null)}
        >
          <div
            style={{
              width: '360px',
              background: '#161616',
              borderRadius: '16px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '24px',
              boxShadow: '#00000099 0px 8px 32px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontFamily: FONT_MEDIUM, fontWeight: 500, fontSize: '16px', lineHeight: '20px', color: '#FFFFFF' }}>
                  确定要删除吗？
                </span>
                <span style={{ fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: 'rgba(255,255,255,0.6)' }}>
                  「{deleteTarget.name}」将被永久删除，无法恢复。
                </span>
              </div>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', cursor: 'pointer', borderRadius: '8px', padding: 0, flexShrink: 0 }}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                  <path d="M2.667 2.667L13.333 13.333" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M2.667 13.333L13.333 2.667" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '36px',
                  flexShrink: 0,
                  borderRadius: '8px',
                  paddingLeft: '16px',
                  paddingRight: '16px',
                  boxShadow: '#00000066 3px 3px 8px',
                  backgroundColor: '#161616',
                  border: '1px solid #FFFFFF14',
                  outline: '1px solid #00000080',
                  cursor: 'pointer',
                  fontFamily: FONT,
                  fontSize: '14px',
                  lineHeight: '18px',
                  color: 'rgba(255,255,255,0.6)',
                }}
              >
                取消
              </button>
              <button
                type="button"
                onClick={confirmDeleteProject}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '36px',
                  flexShrink: 0,
                  borderRadius: '8px',
                  paddingLeft: '16px',
                  paddingRight: '16px',
                  backgroundColor: '#D13B3B',
                  border: '1px solid rgba(255,255,255,0.2)',
                  cursor: 'pointer',
                  fontFamily: FONT_MEDIUM,
                  fontWeight: 500,
                  fontSize: '14px',
                  lineHeight: '18px',
                  color: '#FFFFFF',
                }}
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch delete confirmation */}
      {batchDeleteConfirm && (
        <ConfirmDialog
          title="确定要删除吗？"
          description={`将删除已选中的 ${selected.size} 项及其所有相关内容，删除后无法恢复。`}
          confirmText="删除"
          onCancel={() => setBatchDeleteConfirm(false)}
          onConfirm={() => {
            setBatchDeleteConfirm(false);
            deleteSelected();
            exitBatch();
          }}
          zIndex={100}
        />
      )}
      {toast && createPortal(
        <div style={{
          position: 'fixed', top: '25vh', left: '50%', transform: 'translateX(-50%)',
          zIndex: 9999, pointerEvents: 'none',
          animation: 'slideUpBounce 250ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '8px', background: 'rgba(30,30,30,0.92)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.1)', whiteSpace: 'nowrap' }}>
            {toast.type === 'success' && (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}><path d="M8 14.667C11.682 14.667 14.667 11.682 14.667 8C14.667 4.318 11.682 1.333 8 1.333C4.318 1.333 1.333 4.318 1.333 8C1.333 11.682 4.318 14.667 8 14.667Z" fill="#52BF92" stroke="#52BF92" strokeWidth="1.333" strokeLinejoin="round"/><path d="M5.333 8L7.333 10L11.333 6" stroke="#FFFFFF" strokeWidth="1.333" strokeLinecap="round" strokeLinejoin="round"/></svg>
            )}
            {toast.type === 'error' && (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}><path d="M8 14.667C11.682 14.667 14.667 11.682 14.667 8C14.667 4.318 11.682 1.333 8 1.333C4.318 1.333 1.333 4.318 1.333 8C1.333 11.682 4.318 14.667 8 14.667Z" fill="#F75F5F" stroke="#F75F5F" strokeWidth="1.333" strokeLinejoin="round"/><path d="M5.333 5.333L10.667 10.667M10.667 5.333L5.333 10.667" stroke="#FFFFFF" strokeWidth="1.333" strokeLinecap="round"/></svg>
            )}
            <span style={{ fontSize: '14px', color: '#FFFFFF', fontFamily: FONT }}>{toast.msg}</span>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

function CreativeAssetsPanel({ isLoggedIn }) {
  const [activeType, setActiveType] = useState('image');
  const [batchMode, setBatchMode] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [toast, setToast] = useState(null);

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  }

  const [batchDeleteConfirm, setBatchDeleteConfirm] = useState(false);
  const generationsByTab = useCreationStore((s) => s.generationsByTab);
  const favorites = useCreationStore((s) => s.favorites);
  const storeDeleteCard = useCreationStore((s) => s.deleteCard);
  const storeDeleteSelectedCards = useCreationStore((s) => s.deleteSelectedCards);
  const storeToggleFavorite = useCreationStore((s) => s.toggleFavorite);
  const historyMeta = useCreationStore((s) => s.historyMeta);
  const mergeHistoryGenerations = useCreationStore((s) => s.mergeHistoryGenerations);
  const updateHistoryMeta = useCreationStore((s) => s.updateHistoryMeta);
  const storeSyncFavorites = useCreationStore((s) => s.syncFavorites);

  // 与 CreationPage 共用同一套 normalizeHistoryItem 逻辑
  function normalizeHistoryItem(item, type) {
    const id = `history-${item.id}`;
    const rawUrl = item.original_url || item.file_url || item.url || '';
    return {
      id,
      backendId: item.id,
      ratio: item.ratio || item.aspect_ratio || '16:9',
      resolution: item.resolution || item.size || '',
      duration: item.duration || undefined,
      model: item.model || '',
      prompt: item.prompt || '',
      refImages: (item.reference_images || item.referenceImages || []).map((img) => {
        const imgUrl = typeof img === 'string' ? img : (img?.url || img?.original_url || '');
        return { url: imgUrl, previewUrl: imgUrl, isAsset: true, name: imgUrl.split('/').pop() || 'ref.png', size: 0 };
      }),
      createdAt: item.created_at || new Date().toISOString(),
      cards: [{
        id: item.id,
        type,
        status: 'done',
        imageUrl: type === 'image' ? rawUrl : null,
        videoUrl: type === 'video' ? rawUrl : null,
        audioUrl: type === 'audio' ? rawUrl : null,
        isFavorite: item.is_favorite ?? item.is_liked ?? item.isLiked ?? false,
      }],
    };
  }

  // 根据视口计算首屏所需条数
  // 创作资产卡片：图片/视频 320×180，gap 16，左右 padding 32；配音列表布局直接给 50
  function calcCreativePageSize(tab) {
    if (tab === 'dubbing') return 50;
    const NAV_W = 48;
    const MODULE_TAB_H = 48; // 模块切换 tab 栏
    const FILTER_TAB_H = 48; // 图片/视频/配音 tab 栏
    const CARD_W = 320;
    const CARD_H = 180;
    const GAP = 16;
    const PAD_X = 32;
    const availW = window.innerWidth - NAV_W - PAD_X * 2;
    const availH = window.innerHeight - MODULE_TAB_H - FILTER_TAB_H;
    const cols = Math.max(1, Math.floor((availW + GAP) / (CARD_W + GAP)));
    const rows = Math.max(1, Math.ceil(availH / (CARD_H + GAP))) + 1;
    return cols * rows;
  }

  const loadHistoryPage = useCallback(async (tab) => {
    if (!isLoggedIn) return;
    const meta = useCreationStore.getState().historyMeta[tab];
    if (meta.loading || !meta.hasMore) return;

    updateHistoryMeta(tab, { loading: true });
    const nextPage = meta.page + 1;
    const pageSize = calcCreativePageSize(tab);

    try {
      let resp;
      if (tab === 'image') {
        resp = await apiListCreationImages({ page: nextPage, page_size: pageSize });
      } else if (tab === 'video') {
        resp = await apiListCreationVideos({ page: nextPage, page_size: pageSize });
      } else {
        resp = await apiListCreationAudios({ page: nextPage, page_size: pageSize });
      }

      const type = tab === 'dubbing' ? 'audio' : tab;
      const list = Array.isArray(resp) ? resp : (resp?.list ?? resp?.items ?? resp?.data ?? []);
      const hasMore = list.length >= pageSize;
      const normalized = list.map((item) => normalizeHistoryItem(item, type));
      mergeHistoryGenerations(tab, normalized);

      // 同步收藏状态
      const latestGens = useCreationStore.getState().generationsByTab[tab] ?? [];
      const syncItems = [];
      for (const gen of latestGens) {
        for (let i = 0; i < gen.cards.length; i++) {
          const card = gen.cards[i];
          if (card.isFavorite !== undefined) {
            syncItems.push({ key: `${gen.id}-${i}`, isFavorite: card.isFavorite });
          }
        }
      }
      if (syncItems.length > 0) storeSyncFavorites(syncItems);

      updateHistoryMeta(tab, { page: nextPage, hasMore, loading: false, initialized: true });
    } catch {
      updateHistoryMeta(tab, { loading: false, initialized: true });
    }
  }, [isLoggedIn, mergeHistoryGenerations, updateHistoryMeta, storeSyncFavorites]);

  // 登录后 / 切换 tab 时，若当前 tab 未初始化则拉第一页
  useEffect(() => {
    if (!isLoggedIn) return;
    const meta = useCreationStore.getState().historyMeta[activeType];
    if (!meta.initialized && !meta.loading) {
      loadHistoryPage(activeType);
    }
  }, [isLoggedIn, activeType, loadHistoryPage]);

  const generations = generationsByTab[activeType] ?? [];
  const days = generationsToDays(generations);

  function toggleSelect(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function selectAll() {
    const allIds = days.flatMap((d) => d.cards.map((c) => c.id));
    const isAllSelected = allIds.length > 0 && allIds.every((id) => selected.has(id));
    setSelected(isAllSelected ? new Set() : new Set(allIds));
  }

  function deleteSelected() {
    const ids = selected;
    const cardIds = [...ids];
    storeDeleteSelectedCards(activeType, ids);
    if (activeType === 'image') apiBatchDeleteImages(cardIds);
    else if (activeType === 'video') apiBatchDeleteVideos(cardIds);
    setSelected(new Set());
  }

  function toggleStar(cardKey, backendId, cardType) {
    const isLiked = favorites.has(cardKey);
    storeToggleFavorite(cardKey);
    showToast(isLiked ? '取消收藏' : '收藏成功');
    if (!backendId) return;
    const type = cardType || activeType;
    const apiCall = type === 'video'
      ? apiToggleVideoFavorite(backendId, !isLiked)
      : apiToggleImageFavorite(backendId, !isLiked);
    apiCall.catch(() => storeToggleFavorite(cardKey)); // rollback on failure
  }

  function deleteSingle(card) {
    storeDeleteCard(activeType, card.genId, card.cardIdx);
    if (activeType === 'image') apiDeleteCreationImage(card.id);
    else if (activeType === 'video') apiDeleteCreationVideo(card.id);
  }

  function exitBatch() {
    setBatchMode(false);
    setSelected(new Set());
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <TabBar tabs={CREATIVE_TYPE_TABS} active={activeType} onChange={(k) => { setActiveType(k); exitBatch(); }} />
        {batchMode ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingLeft: '24px', paddingRight: '24px', gap: '8px', flex: 1, height: '48px' }}>
            <span style={{ fontFamily: FONT, fontSize: '14px', color: '#FFFFFF99' }}>已选 {selected.size} 项</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <GhostBtn onClick={selectAll}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                  <path d="M14 6.667V13C14 13.552 13.552 14 13 14H3C2.448 14 2 13.552 2 13V3C2 2.448 2.448 2 3 2H10" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M5.333 6.667L8.667 9.333L13.667 2.333" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span style={{ fontFamily: FONT, fontSize: '14px', color: '#FFFFFF', whiteSpace: 'nowrap' }}>全选</span>
              </GhostBtn>
              <GhostBtn onClick={() => {}}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, rotate: '180deg', transformOrigin: '50% 50%' }}>
                  <path d="M8.003 4.7V14" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M4 8.667L8 4.667L12 8.667" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M4 2H12" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span style={{ fontFamily: FONT, fontSize: '14px', color: '#FFFFFF', whiteSpace: 'nowrap' }}>下载</span>
              </GhostBtn>
              <PlainBtn onClick={() => setBatchDeleteConfirm(true)} danger>
                <TrashIcon color="#F75F5F" />
                <span style={{ fontFamily: FONT, fontSize: '14px', color: '#F75F5F', whiteSpace: 'nowrap' }}>删除</span>
              </PlainBtn>
              <PlainBtn onClick={exitBatch}>
                <span style={{ fontFamily: FONT, fontSize: '14px', color: '#FFFFFFCC', whiteSpace: 'nowrap' }}>取消</span>
              </PlainBtn>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingLeft: '24px', paddingRight: '24px', height: '48px', flexShrink: 0 }}>
            <GhostBtn onClick={() => setBatchMode(true)}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                <path d="M11.333 1.667H2.667C2.114 1.667 1.667 2.114 1.667 2.667V11.333C1.667 11.886 2.114 12.333 2.667 12.333H11.333C11.886 12.333 12.333 11.886 12.333 11.333V2.667C12.333 2.114 11.886 1.667 11.333 1.667Z" stroke="#FFFFFF" strokeLinejoin="round" />
                <path d="M14.667 4.334V14C14.667 14.368 14.368 14.667 14 14.667H4.334" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M4.333 6.829L6.333 8.67L9.667 5.24" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span style={{ fontFamily: FONT, fontSize: '14px', color: '#FFFFFF', whiteSpace: 'nowrap' }}>批量操作</span>
            </GhostBtn>
          </div>
        )}
      </div>

      <div style={{
        flex: 1,
        overflowY: 'auto',
        paddingTop: '16px',
        paddingBottom: '16px',
        paddingLeft: '32px',
        paddingRight: '32px',
        display: 'flex',
        flexDirection: 'column',
        gap: '32px',
        alignItems: days.length === 0 ? 'center' : undefined,
        justifyContent: days.length === 0 ? 'center' : undefined,
      }}>
        {days.length === 0 ? (
          <EmptyCreativeAssets type={activeType} />
        ) : days.map((day) => (
          <div key={day.date} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontFamily: FONT, fontSize: '14px', color: '#FFFFFF99', flexShrink: 0 }}>{day.date}</span>
            </div>
            <div style={activeType === 'dubbing' ? { display: 'flex', flexDirection: 'column', gap: '8px' } : { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '16px' }}>
              {day.cards.map((card) => {
                const isStarred = favorites.has(card.id);
                return activeType === 'dubbing' ? (
                  <AudioCard
                    key={card.id}
                    name={card.name}
                    duration={card.duration}
                    starred={isStarred}
                    selected={batchMode && selected.has(card.id)}
                    batchMode={batchMode}
                    onSelect={() => toggleSelect(card.id)}
                    onStar={() => toggleStar(card.id, card.backendId, card.type)}
                    onDownload={() => {}}
                    onDelete={() => deleteSingle(card)}
                  />
                ) : (
                  <AssetCard
                    key={card.id}
                    name={card.name}
                    bgColor="#1F2324"
                    url={card.url || null}
                    starred={isStarred}
                    selected={batchMode && selected.has(card.id)}
                    batchMode={batchMode}
                    showStar
                    onSelect={() => toggleSelect(card.id)}
                    onStar={() => toggleStar(card.id, card.backendId, card.type)}
                    onDownload={() => {}}
                    onDelete={() => deleteSingle(card)}
                    asset={card}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
      {/* 批量删除二次确认 */}
      {batchDeleteConfirm && (
        <ConfirmDialog
          title="确定要删除吗？"
          description={`将删除已选中的 ${selected.size} 项创作资产，删除后无法恢复。`}
          confirmText="删除"
          onCancel={() => setBatchDeleteConfirm(false)}
          onConfirm={() => {
            setBatchDeleteConfirm(false);
            deleteSelected();
            exitBatch();
          }}
          zIndex={100}
        />
      )}
      {toast && createPortal(
        <div style={{
          position: 'fixed', top: '25vh', left: '50%', transform: 'translateX(-50%)',
          zIndex: 9999, pointerEvents: 'none',
          animation: 'slideUpBounce 250ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '8px', background: 'rgba(30,30,30,0.92)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.1)', whiteSpace: 'nowrap' }}>
            {toast.type === 'success' && (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}><path d="M8 14.667C11.682 14.667 14.667 11.682 14.667 8C14.667 4.318 11.682 1.333 8 1.333C4.318 1.333 1.333 4.318 1.333 8C1.333 11.682 4.318 14.667 8 14.667Z" fill="#52BF92" stroke="#52BF92" strokeWidth="1.333" strokeLinejoin="round"/><path d="M5.333 8L7.333 10L11.333 6" stroke="#FFFFFF" strokeWidth="1.333" strokeLinecap="round" strokeLinejoin="round"/></svg>
            )}
            {toast.type === 'error' && (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}><path d="M8 14.667C11.682 14.667 14.667 11.682 14.667 8C14.667 4.318 11.682 1.333 8 1.333C4.318 1.333 1.333 4.318 1.333 8C1.333 11.682 4.318 14.667 8 14.667Z" fill="#F75F5F" stroke="#F75F5F" strokeWidth="1.333" strokeLinejoin="round"/><path d="M5.333 5.333L10.667 10.667M10.667 5.333L5.333 10.667" stroke="#FFFFFF" strokeWidth="1.333" strokeLinecap="round"/></svg>
            )}
            <span style={{ fontSize: '14px', color: '#FFFFFF', fontFamily: FONT }}>{toast.msg}</span>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

const MODULE_TABS = [
  { key: 'project', label: '项目资产' },
  { key: 'creative', label: '创作资产' },
];

export default function AssetsPage({ projects, isLoggedIn }) {  const [activeModule, setActiveModule] = useState('project');

  return (
    <div style={{
      flex: '1 1 0%',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      height: '100%',
      paddingBottom: '24px',
      paddingRight: '24px',
    }}>
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        borderRadius: '16px',
        border: '1px solid #FFFFFF14',
        backgroundColor: '#161616',
        overflow: 'hidden',
      }}>
        <ModuleTabBar tabs={MODULE_TABS} active={activeModule} onChange={setActiveModule} />
        {activeModule === 'project' ? <ProjectAssetsPanel /> : <CreativeAssetsPanel isLoggedIn={isLoggedIn} />}
      </div>
    </div>
  );
}
