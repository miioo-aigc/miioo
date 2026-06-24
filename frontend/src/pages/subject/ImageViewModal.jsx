import { useState } from "react";
import { useModalSize } from '../../utils/useModalSize';
import { FONT, FONT_MEDIUM } from '../../utils/fonts';
import { apiDownloadSubjectImage } from '../../api/subject';
import { triggerBlobDownload } from '../../utils/downloadImage';
import DotsLoading from '../../components/DotsLoading';

export default function ImageViewModal({ open, imageUrl, imageId, projectId, subjectId, onClose }) {
  const { width: modalW, height: modalH } = useModalSize();
  const [closeHovered, setCloseHovered] = useState(false);
  const [downloadHovered, setDownloadHovered] = useState(false);
  const [downloadPressed, setDownloadPressed] = useState(false);
  const [downloading, setDownloading] = useState(false);

  async function handleDownload() {
    if (downloading || !projectId || !subjectId || !imageId) return;
    setDownloading(true);
    try {
      const blob = await apiDownloadSubjectImage(projectId, subjectId, imageId);
      triggerBlobDownload(blob, `subject-image-${imageId}.jpg`);
    } catch (err) {
      console.error('[ImageViewModal] 下载失败:', err);
    } finally {
      setDownloading(false);
    }
  }
  if (!open) return null;
  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
      onClick={onClose}
    >
      <div
        style={{ display: 'flex', flexDirection: 'column', width: `${modalW}px`, borderRadius: '16px', overflow: 'hidden', height: `${modalH}px` }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', background: '#161616', borderRadius: '16px 16px 0 0', flexShrink: 0 }}>
          <span style={{ fontFamily: FONT_MEDIUM, fontSize: '16px', lineHeight: '20px', color: '#FFFFFF' }}>查看</span>
          <div
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', borderRadius: '6px', background: closeHovered ? '#FFFFFF14' : 'transparent', transition: 'background 120ms' }}
            onClick={onClose}
            onMouseEnter={() => setCloseHovered(true)}
            onMouseLeave={() => setCloseHovered(false)}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
              <path d="M12 4L4 12M4 4l8 8" stroke={closeHovered ? '#FFFFFF' : '#FFFFFFCC'} strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
        </div>
        {/* image area */}
        <div style={{ flex: 1, display: 'flex', padding: '8px 24px', overflow: 'hidden', gap: '12px', flexDirection: 'column', background: '#161616', minHeight: 0 }}>
          {imageUrl
            ? <img src={imageUrl} alt="" style={{ width: '100%', flex: 1, borderRadius: '8px', objectFit: 'contain', minHeight: 0 }} />
            : <div style={{ width: '100%', flex: 1, borderRadius: '8px', background: '#FFFFFF14' }} />
          }
        </div>
        {/* footer */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', justifyContent: 'flex-end', background: '#161616', borderRadius: '0 0 16px 16px', padding: '16px 24px', flexShrink: 0 }}>
          {/* 下载按钮 */}
          <div
            className="flex flex-col shrink-0 rounded-[8px] cursor-pointer"
            style={{ height: '36px', padding: '1px', backgroundImage: downloadHovered ? 'linear-gradient(in oklab 148.76deg, oklab(94.7% -0.078 -0.022 / 45%) 3.64%, oklab(75.5% -0.102 -0.072 / 0%) 42.81%), linear-gradient(in oklab 180deg, #FFFFFF1E, #FFFFFF1E)' : 'linear-gradient(in oklab 148.76deg, oklab(94.7% -0.078 -0.022 / 30%) 3.64%, oklab(75.5% -0.102 -0.072 / 0%) 42.81%), linear-gradient(in oklab 180deg, #FFFFFF14, #FFFFFF14)', boxShadow: '#00000066 3px 3px 8px', outline: '1px solid #00000080', transition: 'background-image 0.15s' }}
            onClick={(e) => { e.stopPropagation(); handleDownload(); }}
            onMouseEnter={() => setDownloadHovered(true)}
            onMouseLeave={() => { setDownloadHovered(false); setDownloadPressed(false); }}
            onMouseDown={() => setDownloadPressed(true)}
            onMouseUp={() => setDownloadPressed(false)}
          >
            <div className="flex items-center flex-1 self-stretch rounded-[7px] gap-[4px] px-[15px]" style={{ backgroundColor: downloadPressed ? '#222222' : downloadHovered ? '#1C1C1C' : '#161616', transition: 'background-color 0.1s' }}>
              {downloading ? (
                <DotsLoading size={3} color="#FFFFFF" gap={2} />
              ) : (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
                  <path d="M8 2.667V10" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M5.333 7.333L8 10L10.667 7.333" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M2.667 12H13.333" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
              <span style={{ fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: '#FFFFFF' }}>下载</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
