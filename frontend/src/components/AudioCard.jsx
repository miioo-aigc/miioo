import { useState, memo } from 'react';
import { FONT } from '../utils/fonts';
import WaveformBars from './WaveformBars';
import AssetsDownloadIcon from './AssetsDownloadIcon';
import AssetsTrashIcon from './AssetsTrashIcon';

function AudioCard({ name, duration = '0:00', starred = false, selected = false, batchMode = false, onDownload, onDelete, onStar, onSelect }) {
  const [hov, setHov] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [starAnim, setStarAnim] = useState(false);
  function handleStar(e) { e.stopPropagation(); setStarAnim(true); setTimeout(() => setStarAnim(false), 300); onStar?.(); }
  return (
    <div style={{ display: 'flex', alignItems: 'center', height: '60px', borderRadius: '8px', padding: '0 16px', gap: '12px', backgroundColor: selected ? '#FFFFFF0F' : hov ? '#FFFFFF08' : 'transparent', border: selected ? '1px solid #2DC3E1' : '1px solid transparent', cursor: 'pointer', transition: 'background-color 0.15s, border-color 0.15s' }}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      onClick={() => { if (batchMode) onSelect?.(); }}>
      <div onClick={() => setPlaying(!playing)} style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {playing ? (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="1.5" y="1" width="3" height="10" rx="1" fill="#2DC3E1"/><rect x="7.5" y="1" width="3" height="10" rx="1" fill="#2DC3E1"/></svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 1L10 6L3 11V1Z" fill="#2DC3E1"/></svg>
        )}
      </div>
      <WaveformBars playing={playing} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
        <span style={{ fontSize: '14px', lineHeight: '18px', color: '#FFFFFF', fontFamily: FONT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
        <span style={{ fontSize: '12px', lineHeight: '14px', color: 'rgba(255,255,255,0.40)', fontFamily: FONT }}>{duration}</span>
      </div>
      {hov && !batchMode && (
        <div style={{ display: 'flex', gap: '4px' }}>
          <div onClick={handleStar} style={{ cursor: 'pointer', display: 'flex' }}>
            <svg width="16" height="16" viewBox="0 0 14 14" fill="none"><path d="M7 1.5l1.545 3.13 3.455.503-2.5 2.436.59 3.44L7 9.369l-3.09 1.64.59-3.44L2 5.133l3.455-.503L7 1.5z" fill={starred ? '#F0B429' : 'none'} stroke={starred ? '#F0B429' : '#FFFFFF66'} strokeWidth="1.1" strokeLinejoin="round"/></svg>
          </div>
          <AssetsDownloadIcon color="#FFFFFF66" onClick={() => onDownload?.()} />
          <AssetsTrashIcon color="#FFFFFF66" onClick={() => onDelete?.()} />
        </div>
      )}
    </div>
  );
}
export default memo(AudioCard);
