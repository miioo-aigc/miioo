import { useState, useEffect, useRef, memo } from 'react';
import UploadMenuItem from './UploadMenuItem';
import isImageFile from '../utils/isImageFile';
import { ALLOWED_EXTS } from '../utils/fileTypes';

function UploadPlaceholder({ onFileSelect, onAssetPick, onDirectClick, disabled = false, allowedExts = ALLOWED_EXTS, acceptAttr = '.txt,.md,.pdf,.docx' }) {
  const [hovered, setHovered] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const fileInputRef = useRef(null);
  const wrapperRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const defaultBack = { opacity: 0.6, bg: '#FFFFFF14', rotate: '0deg' };
  const defaultFront = { bg: '#262626', rotate: '345deg', tx: 'calc(-50% - 7.015px)', ty: 'calc(-50% + 6.717px)' };
  const defaultIcon = { stroke: '#FFFFFF33', tx: 'calc(-50% - 1.349px)', ty: 'calc(-50% + 1.757px)', rotate: '345deg' };
  const hoverBack = { opacity: 0.6, bg: '#FFFFFF3D', rotate: '5deg' };
  const hoverFront = { bg: '#3D3D3D', rotate: '351deg', tx: 'calc(-50% - 4.422px)', ty: 'calc(-50% + 3.811px)' };
  const hoverIcon = { stroke: '#FFFFFF80', tx: 'calc(-50% - 0.865px)', ty: 'calc(-50% + 1.012px)', rotate: '351deg' };

  const isActive = hovered || menuOpen;
  const back = isActive ? hoverBack : defaultBack;
  const front = isActive ? hoverFront : defaultFront;
  const icon = isActive ? hoverIcon : defaultIcon;
  const transition = 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)';

  const handleChange = (e) => {
    const selected = Array.from(e.target.files || []);
    if (!selected.length) return;
    const invalid = selected.filter((file) => {
      const ext = '.' + file.name.split('.').pop().toLowerCase();
      return !allowedExts.includes(ext);
    });
    if (invalid.length) {
      alert(`仅支持 ${allowedExts.join('、')} 格式的文件`);
      e.target.value = '';
      return;
    }
    const oversizedImg = selected.find((file) => isImageFile(file) && file.size > 20 * 1024 * 1024);
    if (oversizedImg) {
      alert('抱歉，平台暂不支持上传20M以上的图片资源！');
      e.target.value = '';
      return;
    }
    onFileSelect?.(selected);
    e.target.value = '';
  };

  return (
    <div ref={wrapperRef} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        type="button"
        onMouseEnter={() => !disabled && setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={() => { if (!disabled) { if (onDirectClick) onDirectClick(); else setMenuOpen((v) => !v); } }}
        disabled={disabled}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0px',
          position: 'relative',
          padding: 0,
          cursor: disabled ? 'not-allowed' : 'pointer',
          background: 'transparent',
          border: 'none',
          opacity: disabled ? 0.45 : 1,
          outline: 'none',
          borderRadius: '8px',
          flexShrink: 0,
        }}
      >
        <input ref={fileInputRef} type="file" multiple accept={acceptAttr} className="hidden" onChange={handleChange} onClick={(e) => e.stopPropagation()} />
        <div style={{ width: '44px', height: '60px', borderRadius: '4px', flexShrink: 0, boxShadow: '#FFFFFF14 0px 0px 0px 0.5px inset', opacity: back.opacity, background: back.bg, rotate: back.rotate, transition }} />
        <div style={{ width: '44px', height: '60px', borderRadius: '4px', position: 'absolute', boxShadow: '#FFFFFF14 0px 0px 0px 0.5px inset', transformOrigin: 'top left', background: front.bg, rotate: front.rotate, left: '50%', top: '50%', translate: `${front.tx} ${front.ty}`, transition }} />
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"
          style={{ position: 'absolute', left: '50%', top: '50%', translate: `${icon.tx} ${icon.ty}`, rotate: icon.rotate, transformOrigin: '0% 0%', transition }}>
          <path d="M8 3v10M3 8h10" stroke={icon.stroke} strokeWidth="1.5" strokeLinecap="round" style={{ transition }} />
        </svg>
      </button>

      {menuOpen && (
        <div style={{
          position: 'absolute',
          zIndex: 50,
          left: 0,
          bottom: 'calc(100% + 8px)',
          borderRadius: '8px',
          background: '#1D1E1E',
          border: '1px solid #FFFFFF0D',
          boxShadow: '0px 4px 16px #00000066',
          padding: '4px',
          minWidth: '140px',
          display: 'flex',
          flexDirection: 'column',
        }}>
          <UploadMenuItem
            label="从资产库选择"
            icon={
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
                <path d="M1.66663 2.66667C1.66663 2.29848 1.9651 2 2.33329 2H6.33329L7.99996 4H13.6666C14.0348 4 14.3333 4.29847 14.3333 4.66667V13.3333C14.3333 13.7015 14.0348 14 13.6666 14H2.33329C1.9651 14 1.66663 13.7015 1.66663 13.3333V2.66667Z" stroke="#FFFFFFCC" strokeLinejoin="round" />
                <path d="M8.00003 6.66663L8.7477 8.30423L10.5362 8.50926L9.20977 9.72636L9.56747 11.4907L8.00003 10.6053L6.4326 11.4907L6.7903 9.72636L5.46387 8.50926L7.25237 8.30423L8.00003 6.66663Z" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            }
            onClick={() => { setMenuOpen(false); onAssetPick?.(); }}
          />
          <UploadMenuItem
            label="从本地上传"
            icon={
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
                <path d="M8 10.667V3.333" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M5.333 6L8 3.333L10.667 6" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M2.667 12H13.333" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            }
            onClick={() => { setMenuOpen(false); fileInputRef.current?.click(); }}
          />
        </div>
      )}
    </div>
  );
}

export default memo(UploadPlaceholder);
