import { useRef, useState } from 'react';
import { Button } from '../ui';
import { normalizeImageUrl } from '../../utils/imageUrl';

export default function StoryboardFinalizedCard({ shot, media, selected = false, onSelect, onCreate, onPreview, onDownload }) {
  const [hovered, setHovered] = useState(false);
  const videoRef = useRef(null);
  const hasMedia = Boolean(media?.url);
  const isVideo = media?.media_type === 'video' || media?.type?.startsWith('video');
  const src = normalizeImageUrl(media?.poster_url || media?.thumbnail_url || media?.url);
  function enter() { setHovered(true); if (hasMedia && isVideo) videoRef.current?.play().catch(() => {}); }
  function leave() { setHovered(false); if (isVideo && videoRef.current) { videoRef.current.pause(); videoRef.current.currentTime = 0; } }
  return (
    <div onClick={onSelect} onMouseEnter={enter} onMouseLeave={leave} style={{ width: '240px', height: '135px', position: 'relative', flexShrink: 0, overflow: 'hidden', borderRadius: '8px', border: `1px solid ${selected ? '#2DC3E1' : 'rgba(255,255,255,0.10)'}`, boxShadow: selected ? '0 0 0 1px rgba(45,195,225,0.30)' : 'none', background: hasMedia ? '#101111' : '#242424', cursor: 'pointer', transition: 'border-color 150ms, box-shadow 150ms' }}>
      {hasMedia && (isVideo ? <video ref={videoRef} src={normalizeImageUrl(media.url)} poster={src} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />)}
      <span style={{ position: 'absolute', top: '6px', left: '12px', padding: '0 8px', borderRadius: '3px', background: '#000000CC', color: '#FFFFFFCC', fontSize: '12px', lineHeight: '20px' }}>{String(shot.number).padStart(2, '0')}</span>
      {hasMedia && <span style={{ position: 'absolute', top: 0, right: 0, padding: '0 10px', background: '#00000080', color: '#FFFFFFCC', fontSize: '12px', lineHeight: '22px' }}>{isVideo ? '视频' : '图片'}</span>}
      {!hasMedia && !hovered && <span style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', color: '#FFFFFF99', fontSize: '12px', lineHeight: '20px', whiteSpace: 'nowrap' }}>分镜{String(shot.number).padStart(2, '0')}</span>}
      <Button
        variant="accent"
        size="small"
        onClick={(event) => { event.stopPropagation(); onCreate?.(); }}
        tabIndex={hovered ? 0 : -1}
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          height: '24px',
          minHeight: '24px',
          boxSizing: 'border-box',
          opacity: hovered ? 1 : 0,
          transform: hovered ? 'translate(-50%, -50%)' : 'translate(-50%, calc(-50% + 12px))',
          pointerEvents: hovered ? 'auto' : 'none',
          transition: 'opacity 180ms ease-out, transform 180ms ease-out',
        }}
      >
        创作
      </Button>
      {hovered && hasMedia && <>
        <div style={{ position: 'absolute', right: '8px', bottom: '6px', display: 'flex', gap: '4px' }}>
          <button type="button" aria-label="放大" onClick={(event) => { event.stopPropagation(); onPreview?.(media); }} style={{ width: '24px', height: '24px', border: 0, borderRadius: '4px', background: '#00000080', color: '#FFF', cursor: 'pointer' }}>⌗</button>
          <button type="button" aria-label="下载" onClick={(event) => { event.stopPropagation(); onDownload?.(media); }} style={{ width: '24px', height: '24px', border: 0, borderRadius: '4px', background: '#00000080', color: '#FFF', cursor: 'pointer' }}>↓</button>
        </div>
      </>}
    </div>
  );
}
