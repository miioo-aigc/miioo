import { createPortal } from 'react-dom';
import { Button } from '../ui';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif";
const FONT_MEDIUM = "'AlibabaPuHuiTi_2_65_Medium','Alibaba_PuHuiTi_2.0',system-ui,sans-serif";

function WarningIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M10 18.333C12.302 18.333 14.385 17.4 15.893 15.892C17.401 14.384 18.334 12.301 18.334 10C18.334 7.699 17.401 5.615 15.893 4.107C14.385 2.599 12.302 1.667 10 1.667C7.699 1.667 5.616 2.599 4.108 4.107C2.6 5.615 1.667 7.699 1.667 10C1.667 12.301 2.6 14.384 4.108 15.892C5.616 17.4 7.699 18.333 10 18.333Z" fill="#EB8B14" stroke="#EB8B14" strokeLinejoin="round" />
      <path fillRule="evenodd" clipRule="evenodd" d="M10 15.417C10.575 15.417 11.041 14.95 11.041 14.375C11.041 13.8 10.575 13.334 10 13.334C9.424 13.334 8.958 13.8 8.958 14.375C8.958 14.95 9.424 15.417 10 15.417Z" fill="#FFFFFF" />
      <path d="M10 5V11.667" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2.667 2.667L13.333 13.333M2.667 13.333L13.333 2.667" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function SeedanceResolutionDialog({ open, onClose }) {
  if (!open) return null;

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }} onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="seedance-resolution-title" style={{ width: '400px', overflow: 'hidden', borderRadius: '16px', background: '#161616', fontSynthesis: 'none', WebkitFontSmoothing: 'antialiased', boxShadow: '0 8px 32px rgba(0,0,0,0.6)' }} onClick={(event) => event.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', padding: '16px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <WarningIcon />
            <div id="seedance-resolution-title" style={{ fontFamily: "'PingFangSC-Medium','PingFang SC',system-ui,sans-serif", fontWeight: 500, fontSize: '16px', lineHeight: '28px', color: '#FFFFFF' }}>分辨率不符合要求</div>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭" style={{ width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, padding: 0, border: 0, borderRadius: '6px', background: 'transparent', cursor: 'pointer' }}><CloseIcon /></button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', padding: '8px 24px' }}>
          <div style={{ alignSelf: 'stretch', fontFamily: FONT, fontSize: '14px', lineHeight: '175%', color: '#FFFFFFCC' }}>
            视频宽高需在 300～6000 像素之间。<br />建议使用 640×640、720×720、960×720、720×960、1280×720 或 720×1280 等常用分辨率。
          </div>
          <div style={{ alignSelf: 'stretch', fontFamily: FONT, fontSize: '14px', lineHeight: '175%', color: '#EB8B14' }}>不支持1080P、2K、4K</div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '16px 24px' }}>
          <Button variant="accent" onClick={onClose} className="h-9 rounded-[8px] px-[16px]" style={{ background: '#EB8B14', backgroundImage: 'none', borderColor: '#FFFFFF33', outline: '1px solid #00000080' }}>
            <span style={{ fontFamily: FONT_MEDIUM, fontWeight: 500, color: '#FFFFFF' }}>我知道了</span>
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
