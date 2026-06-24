import { useState, memo } from 'react';
import { FONT, FONT_MEDIUM } from '../utils/fonts';

function ImageViewModal({ imageUrl, onClose, isVideo = false }) {
  const [closeHovered, setCloseHovered] = useState(false);
  const [doneHovered, setDoneHovered] = useState(false);
  const [donePressed, setDonePressed] = useState(false);
  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
      onClick={onClose}
    >
      <div
        style={{ display: 'flex', flexDirection: 'column', width: '800px', borderRadius: '16px', overflow: 'hidden', height: '600px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', background: '#161616', borderRadius: '16px 16px 0 0', flexShrink: 0 }}>
          <span style={{ fontFamily: FONT_MEDIUM, fontSize: '16px', lineHeight: '20px', color: '#FFFFFF' }}>查看</span>
          <div
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', borderRadius: '6px', background: closeHovered ? '#FFFFFF14' : 'transparent', transition: 'background 120ms' }}
            onClick={onClose}
            onMouseEnter={() => setCloseHovered(true)}
            onMouseLeave={() => setCloseHovered(false)}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M12 4L4 12M4 4l8 8" stroke={closeHovered ? '#FFFFFF' : '#FFFFFFCC'} strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
        </div>
        <div style={{ flex: 1, display: 'flex', padding: '8px 24px', overflow: 'hidden', gap: '12px', flexDirection: 'column', background: '#161616', minHeight: 0 }}>
          {isVideo
            ? <video src={imageUrl} controls autoPlay muted style={{ width: '100%', flex: 1, borderRadius: '8px', objectFit: 'contain', minHeight: 0 }} />
            : <img src={imageUrl} alt="" style={{ width: '100%', flex: 1, borderRadius: '8px', objectFit: 'contain', minHeight: 0 }} />}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', justifyContent: 'flex-end', background: '#161616', borderRadius: '0 0 16px 16px', padding: '16px 24px', flexShrink: 0 }}>
          <div
            className="flex flex-col shrink-0 rounded-[8px] cursor-pointer"
            style={{ height: '36px', padding: '1px', backgroundImage: doneHovered ? 'linear-gradient(in oklab 148.76deg, oklab(94.7% -0.078 -0.022 / 45%) 3.64%, oklab(75.5% -0.102 -0.072 / 0%) 42.81%), linear-gradient(in oklab 180deg, #FFFFFF1E, #FFFFFF1E)' : 'linear-gradient(in oklab 148.76deg, oklab(94.7% -0.078 -0.022 / 30%) 3.64%, oklab(75.5% -0.102 -0.072 / 0%) 42.81%), linear-gradient(in oklab 180deg, #FFFFFF14, #FFFFFF14)', boxShadow: '#00000066 3px 3px 8px', outline: '1px solid #00000080', transition: 'background-image 0.15s' }}
            onClick={onClose}
            onMouseEnter={() => setDoneHovered(true)}
            onMouseLeave={() => { setDoneHovered(false); setDonePressed(false); }}
            onMouseDown={() => setDonePressed(true)}
            onMouseUp={() => setDonePressed(false)}
          >
            <div className="flex items-center flex-1 self-stretch rounded-[7px] gap-[4px] px-[15px]" style={{ backgroundColor: donePressed ? '#222222' : doneHovered ? '#1C1C1C' : '#161616', transition: 'background-color 0.1s' }}>
              <span style={{ fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: '#FFFFFF' }}>完成</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(ImageViewModal);
