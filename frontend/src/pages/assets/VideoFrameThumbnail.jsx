import { memo } from 'react';
import { FONT } from '../../utils/fonts';

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

export default memo(VideoFrameThumbnail);
