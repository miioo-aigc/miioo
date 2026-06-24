import { useState, useEffect, memo } from "react";
import { createPortal } from "react-dom";
import { useModalSize } from "../utils/useModalSize";
import { FONT } from "../utils/fonts";
function MediaViewModal({ url, onClose }) {
  const { width: modalW, height: modalH } = useModalSize();
  const [closeHov, setCloseHov] = useState(false);
  const [downloadHov, setDownloadHov] = useState(false);
  const [downloadPressed, setDownloadPressed] = useState(false);

  function downloadImage(imageUrl) {
    const a = document.createElement('a');
    a.href = imageUrl;
    a.download = imageUrl.split('/').pop() || 'image.jpg';
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
  return createPortal(
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
      onClick={onClose}
    >
      <div
        style={{ display: 'flex', flexDirection: 'column', width: `${modalW}px`, height: `${modalH}px`, borderRadius: '16px', overflow: 'hidden' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', background: '#161616', borderRadius: '16px 16px 0 0', flexShrink: 0 }}>
          <span style={{ fontFamily: FONT_MEDIUM, fontSize: '16px', lineHeight: '20px', color: '#FFFFFF' }}>查看</span>
          <div
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', borderRadius: '6px', background: closeHov ? '#FFFFFF14' : 'transparent', transition: 'background 120ms' }}
            onClick={onClose}
            onMouseEnter={() => setCloseHov(true)}
            onMouseLeave={() => setCloseHov(false)}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M12 4L4 12M4 4l8 8" stroke={closeHov ? '#FFFFFF' : '#FFFFFFCC'} strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
        </div>
        {/* image area */}
        <div style={{ flex: 1, display: 'flex', padding: '8px 24px', overflow: 'hidden', flexDirection: 'column', background: '#161616', minHeight: 0 }}>
          <img src={url} alt="" style={{ width: '100%', flex: 1, borderRadius: '8px', objectFit: 'contain', minHeight: 0 }} />
        </div>
        {/* footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', background: '#161616', borderRadius: '0 0 16px 16px', padding: '16px 24px', flexShrink: 0, gap: '12px' }}>
          <div
            style={{ display: 'flex', flexDirection: 'column', height: '36px', flexShrink: 0, borderRadius: '8px', padding: '1px', backgroundImage: downloadHov ? 'linear-gradient(in oklab 148.76deg, oklab(94.7% -0.078 -0.022 / 45%) 3.64%, oklab(75.5% -0.102 -0.072 / 0%) 42.81%), linear-gradient(in oklab 180deg, #FFFFFF1E, #FFFFFF1E)' : 'linear-gradient(in oklab 148.76deg, oklab(94.7% -0.078 -0.022 / 30%) 3.64%, oklab(75.5% -0.102 -0.072 / 0%) 42.81%), linear-gradient(in oklab 180deg, #FFFFFF14, #FFFFFF14)', boxShadow: '#00000066 3px 3px 8px', outline: '1px solid #00000080', cursor: 'pointer', transition: 'background-image 0.15s' }}
            onClick={() => downloadImage(url)}
            onMouseEnter={() => setDownloadHov(true)}
            onMouseLeave={() => { setDownloadHov(false); setDownloadPressed(false); }}
            onMouseDown={() => setDownloadPressed(true)}
            onMouseUp={() => setDownloadPressed(false)}
          >
            <div style={{ display: 'flex', alignItems: 'center', flex: 1, alignSelf: 'stretch', borderRadius: '7px', gap: '4px', paddingInline: '15px', backgroundColor: downloadPressed ? '#222222' : downloadHov ? '#1C1C1C' : '#161616', transition: 'background-color 0.1s' }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
                <path d="M8 2.667V10" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M5.333 7.333L8 10L10.667 7.333" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M2.667 12H13.333" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span style={{ fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: '#FFFFFF' }}>下载</span>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}


export default memo(MediaViewModal);
