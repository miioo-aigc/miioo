import { useState } from 'react';
import { FONT } from '../../utils/fonts';
import WaveformBars from '../../components/WaveformBars';

import StarIcon from "../../components/StarIcon";
import TrashIcon from "./TrashIcon";
import DownloadIcon from "./DownloadIcon";
export default function AudioCard({ name, duration = '0:00', starred = false, selected = false, batchMode = false, onDownload, onDelete, onStar, onSelect }) {
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




// 主体资产详情弹窗 — 图片列表（角色/场景/道具的多张图聚合）

// Props: name, description, prompt, model, ratio, resolution, images (array of {id, src, finalized})
// images[0] should be the finalized image; default activeImg = index of first finalized image

// Props: shotNumber, prompt, model, resolution, images (array of {id, src, finalized})





