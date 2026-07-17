import { useEffect, useRef } from 'react';
import AssetsMoreMenu from './AssetsMoreMenu';

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

function SelectedMark() {
  return (
    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
      <path d="M1 4L3.5 6.5L9 1" stroke="#000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * 创作资产卡片的媒体展示层。
 * 只负责媒体、批量选择、更多菜单和收藏按钮的视觉与交互出口，
 * 不读取页面状态、不调用 API；详情和业务动作仍由 AssetCard 持有。
 */
export default function AssetCardMedia({
  name,
  url = null,
  starred = false,
  selected = false,
  batchMode = false,
  showStar = false,
  asset = {},
  hovered = false,
  starAnim = false,
  onHoverChange,
  onStar,
  onDownload,
  onDelete,
}) {
  const videoRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (hovered) {
      video.currentTime = 0;
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, [hovered]);

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: hovered ? '#343434' : '#272727',
        transition: 'background-color 0.15s',
        position: 'relative',
      }}
      onMouseEnter={() => onHoverChange?.(true)}
      onMouseLeave={() => onHoverChange?.(false)}
    >
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
          {selected && <SelectedMark />}
        </div>
      ) : hovered && !showStar ? (
        <div style={{ position: 'absolute', top: '8px', right: '8px' }}>
          <AssetsMoreMenu onDownload={onDownload} onDelete={onDelete} />
        </div>
      ) : null}

      {showStar && !batchMode && (
        <div style={{ position: 'absolute', top: '8px', right: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ opacity: hovered ? 1 : 0, transition: 'opacity 0.15s' }}>
            <AssetsMoreMenu onDownload={onDownload} onDelete={onDelete} />
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
              opacity: hovered || starred ? 1 : 0,
              transform: starAnim ? 'scale(1.4)' : 'scale(1)',
              transition: 'transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.15s',
            }}
            onClick={onStar}
          >
            <StarIcon filled={starred} />
          </button>
        </div>
      )}
    </div>
  );
}
