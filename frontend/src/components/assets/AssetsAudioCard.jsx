/**
 * @file AssetsAudioCard.jsx
 * @structure-index
 *
 * ─── 原子展示 ───────────────────────────────────────────────────────
 *   <WaveformBars>                  音频波形条
 *   <DownloadIcon> / <TrashIcon>    操作图标
 *   <StarIcon>                      收藏图标
 *
 * ─── 业务域组件 ────────────────────────────────────────────────────
 *   <AssetsAudioCard>               音频资产卡片、播放态和操作出口
 *
 * ─── 数据边界 ─────────────────────────────────────────────────────
 *   只管理卡片内部悬停、播放视觉态和收藏动画；下载、删除、收藏与
 *   批量选中、详情打开通过显式回调交给页面，不调用 API、不读取 Store。
 */

import { useState } from 'react';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif";

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

function WaveformBars({ playing }) {
  const bars = [3, 6, 10, 7, 14, 9, 5, 12, 8, 4, 11, 7, 6, 13, 9, 5, 10, 7, 4, 8, 12, 6, 9, 5, 11, 7, 3, 10, 8, 6];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '2px', height: '24px' }}>
      {bars.map((height, index) => (
        <div
          key={index}
          style={{
            width: '2px',
            height: `${height}px`,
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

export default function AssetsAudioCard({
  name,
  duration = '0:00',
  starred = false,
  selected = false,
  batchMode = false,
  onDownload,
  onDelete,
  onStar,
  onSelect,
  onOpen,
}) {
  const [hovered, setHovered] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [starAnim, setStarAnim] = useState(false);

  function handleStar(event) {
    event.stopPropagation();
    setStarAnim(true);
    setTimeout(() => setStarAnim(false), 300);
    onStar?.();
  }

  function handlePlay(event) {
    event.stopPropagation();
    setPlaying((value) => !value);
  }

  return (
    <div
      style={{
        width: '100%',
        borderRadius: '10px',
        backgroundColor: '#1C1C1C',
        border: selected ? '1px solid #2DC3E1' : hovered ? '1px solid #FFFFFF33' : '1px solid #FFFFFF0F',
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
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => { if (batchMode) onSelect?.(); else onOpen?.(); }}
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
              <rect x="2" y="1.5" width="3" height="9" rx="1" fill="#000" />
              <rect x="7" y="1.5" width="3" height="9" rx="1" fill="#000" />
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', opacity: hovered ? 1 : 0, transition: 'opacity 0.15s' }}>
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
              onClick={(event) => { event.stopPropagation(); onDownload?.(); }}
            >
              <DownloadIcon color="#FFFFFF99" />
            </button>
            <button
              type="button"
              style={{ width: '28px', height: '28px', borderRadius: '6px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
              onClick={(event) => { event.stopPropagation(); onDelete?.(); }}
            >
              <TrashIcon color="#FFFFFF66" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
