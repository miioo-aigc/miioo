import { useEffect, useRef, useState } from 'react';
import {
  ALLOWED_EXTS,
  ALLOWED_IMAGE_EXTS,
  MAX_CREATION_IMAGE_BYTES,
  isFileOverLimit,
  isImageFile,
} from './CreationFileUtils';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif";

function UploadMenuItem({ label, icon, onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: '8px', width: '100%', height: '32px',
        paddingLeft: '10px', paddingRight: '10px', borderRadius: '6px', cursor: 'pointer',
        border: 'none', textAlign: 'left', fontFamily: FONT, fontSize: '12px', lineHeight: '16px',
        color: '#FFFFFFCC', background: hovered ? '#FFFFFF0A' : 'transparent', transition: 'background 0.15s',
      }}
    >
      {icon}
      {label}
    </button>
  );
}

export function UploadPlaceholder({ onFileSelect, onAssetPick, onDirectClick, disabled = false, allowedExts = ALLOWED_EXTS, acceptAttr = '.txt,.md,.pdf,.docx' }) {
  const [hovered, setHovered] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const fileInputRef = useRef(null);
  const wrapperRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const handler = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) setMenuOpen(false);
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

  const handleChange = (event) => {
    const selected = Array.from(event.target.files || []);
    if (!selected.length) return;
    const invalid = selected.filter((file) => {
      const ext = '.' + file.name.split('.').pop().toLowerCase();
      return !allowedExts.includes(ext);
    });
    if (invalid.length) {
      alert(`仅支持 ${allowedExts.join('、')} 格式的文件`);
      event.target.value = '';
      return;
    }
    const oversizedImg = selected.find((file) => isImageFile(file) && isFileOverLimit(file, MAX_CREATION_IMAGE_BYTES));
    if (oversizedImg) {
      alert('抱歉，平台暂不支持上传20M以上的图片资源！');
      event.target.value = '';
      return;
    }
    onFileSelect?.(selected);
    event.target.value = '';
  };

  return (
    <div ref={wrapperRef} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        type="button"
        onMouseEnter={() => !disabled && setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={() => { if (!disabled) { if (onDirectClick) onDirectClick(); else setMenuOpen((value) => !value); } }}
        disabled={disabled}
        style={{ display: 'flex', alignItems: 'center', gap: '0px', position: 'relative', padding: 0, cursor: disabled ? 'not-allowed' : 'pointer', background: 'transparent', border: 'none', opacity: disabled ? 0.45 : 1, outline: 'none', borderRadius: '8px', flexShrink: 0 }}
      >
        <input ref={fileInputRef} type="file" multiple accept={acceptAttr} className="hidden" onChange={handleChange} onClick={(event) => event.stopPropagation()} />
        <div style={{ width: '44px', height: '60px', borderRadius: '4px', flexShrink: 0, boxShadow: '#FFFFFF14 0px 0px 0px 0.5px inset', opacity: back.opacity, background: back.bg, rotate: back.rotate, transition }} />
        <div style={{ width: '44px', height: '60px', borderRadius: '4px', position: 'absolute', boxShadow: '#FFFFFF14 0px 0px 0px 0.5px inset', transformOrigin: 'top left', background: front.bg, rotate: front.rotate, left: '50%', top: '50%', translate: `${front.tx} ${front.ty}`, transition }} />
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ position: 'absolute', left: '50%', top: '50%', translate: `${icon.tx} ${icon.ty}`, rotate: icon.rotate, transformOrigin: '0% 0%', transition }}>
          <path d="M8 3v10M3 8h10" stroke={icon.stroke} strokeWidth="1.5" strokeLinecap="round" style={{ transition }} />
        </svg>
      </button>
      {menuOpen && (
        <div style={{ position: 'absolute', zIndex: 50, left: 0, bottom: 'calc(100% + 8px)', borderRadius: '8px', background: '#1D1E1E', border: '1px solid #FFFFFF0D', boxShadow: '0px 4px 16px #00000066', padding: '4px', minWidth: '140px', display: 'flex', flexDirection: 'column' }}>
          <UploadMenuItem
            label="从资产库选择"
            icon={<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}><path d="M1.66663 2.66667C1.66663 2.29848 1.9651 2 2.33329 2H6.33329L7.99996 4H13.6666C14.0348 4 14.3333 4.29847 14.3333 4.66667V13.3333C14.3333 13.7015 14.0348 14 13.6666 14H2.33329C1.9651 14 1.66663 13.7015 1.66663 13.3333V2.66667Z" stroke="#FFFFFFCC" strokeLinejoin="round" /><path d="M8.00003 6.66663L8.7477 8.30423L10.5362 8.50926L9.20977 9.72636L9.56747 11.4907L8.00003 10.6053L6.4326 11.4907L6.7903 9.72636L5.46387 8.50926L7.25237 8.30423L8.00003 6.66663Z" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" /></svg>}
            onClick={() => { setMenuOpen(false); onAssetPick?.(); }}
          />
          <UploadMenuItem
            label="从本地上传"
            icon={<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}><path d="M8 10.667V3.333" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" /><path d="M5.333 6L8 3.333L10.667 6" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" /><path d="M2.667 12H13.333" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" /></svg>}
            onClick={() => { setMenuOpen(false); fileInputRef.current?.click(); }}
          />
        </div>
      )}
    </div>
  );
}

function FrameUploader({ firstFile, lastFile, onFirstChange, onLastChange, onSwap, onFirstAssetPick, onLastAssetPick, disabled = false }) {
  const firstInputRef = useRef(null);
  const lastInputRef = useRef(null);
  const firstWrapperRef = useRef(null);
  const lastWrapperRef = useRef(null);
  const [firstHovered, setFirstHovered] = useState(false);
  const [lastHovered, setLastHovered] = useState(false);
  const [swapHovered, setSwapHovered] = useState(false);
  const [firstMenuOpen, setFirstMenuOpen] = useState(false);
  const [lastMenuOpen, setLastMenuOpen] = useState(false);

  useEffect(() => {
    if (!firstMenuOpen && !lastMenuOpen) return undefined;
    const handler = (event) => {
      if (firstWrapperRef.current && !firstWrapperRef.current.contains(event.target)) setFirstMenuOpen(false);
      if (lastWrapperRef.current && !lastWrapperRef.current.contains(event.target)) setLastMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [firstMenuOpen, lastMenuOpen]);

  const handleFile = (event, isFirst) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (!ALLOWED_IMAGE_EXTS.includes(ext)) {
      alert(`仅支持 ${ALLOWED_IMAGE_EXTS.join('、')} 格式的图片`);
      event.target.value = '';
      return;
    }
    if (isFileOverLimit(file, MAX_CREATION_IMAGE_BYTES)) {
      alert('抱歉，平台暂不支持上传20M以上的图片资源！');
      event.target.value = '';
      return;
    }
    if (isFirst) onFirstChange(file);
    else onLastChange(file);
    event.target.value = '';
  };

  const renderSlot = ({ label, file, hovered, setHovered, wrapperRef, inputRef, menuOpen, setMenuOpen, onChange, onAssetPick, isFirst }) => {
    const preview = file ? (file.previewUrl || file.url || null) : null;
    const hasImg = !!preview;
    return (
      <div ref={wrapperRef} style={{ position: 'relative', flexShrink: 0 }}>
        <input ref={inputRef} type="file" accept={ALLOWED_IMAGE_EXTS.join(',')} className="hidden" onChange={(event) => { handleFile(event, isFirst); setMenuOpen(false); }} />
        <button type="button" disabled={disabled} onClick={() => { if (!disabled) setMenuOpen((value) => !value); }} onMouseEnter={() => !disabled && setHovered(true)} onMouseLeave={() => setHovered(false)} style={{ width: '44px', height: '60px', borderRadius: '4px', flexShrink: 0, boxShadow: '#FFFFFF14 0px 0px 0px 0.5px inset', background: hasImg ? `url(${preview}) center/cover no-repeat` : hovered ? '#3D3D3D' : '#262626', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.45 : 1, position: 'relative', border: 'none', padding: 0, outline: 'none', overflow: 'visible', transition: 'background 0.35s cubic-bezier(0.4, 0, 0.2, 1)' }}>
          {!hasImg && <><svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ position: 'absolute', left: '50%', top: 'calc(50% - 9px)', translate: '-50% -50%' }}><path d="M8 3v10M3 8h10" stroke={hovered ? '#FFFFFFCC' : '#FFFFFF33'} strokeWidth="1.5" strokeLinecap="round" /></svg><div style={{ position: 'absolute', left: '50%', top: 'calc(50% + 7px)', translate: '-50% -50%', fontFamily: FONT, fontSize: '10px', lineHeight: '12px', color: hovered ? '#FFFFFFCC' : '#FFFFFF66' }}>{label}</div></>}
          {hasImg && hovered && <><div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', borderRadius: '4px' }} /><div role="button" tabIndex={0} onClick={(event) => { event.stopPropagation(); event.preventDefault(); onChange(null); }} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.stopPropagation(); event.preventDefault(); onChange(null); } }} style={{ position: 'absolute', top: '-7px', right: '-7px', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '16px', height: '16px', borderRadius: '9999px', background: '#505151', border: 'none', cursor: 'pointer', padding: 0 }}><svg width="10" height="10" viewBox="0 0 16 16" fill="none"><path d="M4.667 4.667L11.333 11.333" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" /><path d="M4.667 11.333L11.333 4.667" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" /></svg></div></>}
        </button>
        {menuOpen && <div style={{ position: 'absolute', zIndex: 50, left: 0, bottom: 'calc(100% + 8px)', borderRadius: '8px', background: '#1D1E1E', border: '1px solid #FFFFFF0D', boxShadow: '0px 4px 16px #00000066', padding: '4px', minWidth: '140px', display: 'flex', flexDirection: 'column' }}>
          <UploadMenuItem label="从资产库选择" icon={<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M1.66663 2.66667C1.66663 2.29848 1.9651 2 2.33329 2H6.33329L7.99996 4H13.6666C14.0348 4 14.3333 4.29847 14.3333 4.66667V13.3333C14.3333 13.7015 14.0348 14 13.6666 14H2.33329C1.9651 14 1.66663 13.7015 1.66663 13.3333V2.66667Z" stroke="#FFFFFFCC" strokeLinejoin="round" /><path d="M8.00003 6.66663L8.7477 8.30423L10.5362 8.50926L9.20977 9.72636L9.56747 11.4907L8.00003 10.6053L6.4326 11.4907L6.7903 9.72636L5.46387 8.50926L7.25237 8.30423L8.00003 6.66663Z" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" /></svg>} onClick={() => { setMenuOpen(false); onAssetPick?.(); }} />
          <UploadMenuItem label="从本地上传" icon={<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 10.667V3.333" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" /><path d="M5.333 6L8 3.333L10.667 6" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" /><path d="M2.667 12H13.333" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" /></svg>} onClick={() => { setMenuOpen(false); inputRef.current?.click(); }} />
        </div>}
      </div>
    );
  };

  return <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
    {renderSlot({ label: '首帧', file: firstFile, hovered: firstHovered, setHovered: setFirstHovered, wrapperRef: firstWrapperRef, inputRef: firstInputRef, menuOpen: firstMenuOpen, setMenuOpen: setFirstMenuOpen, onChange: onFirstChange, onAssetPick: onFirstAssetPick, isFirst: true })}
    <button type="button" disabled={disabled} onClick={onSwap} onMouseEnter={() => setSwapHovered(true)} onMouseLeave={() => setSwapHovered(false)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px', padding: '2px', cursor: disabled ? 'not-allowed' : 'pointer', background: swapHovered ? '#FFFFFF0A' : 'transparent', border: 'none', opacity: disabled ? 0.45 : 1, transition: 'background 0.15s' }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M8.5 5.5a1 1 0 0 0-1.707-.707l-3 3A1 1 0 0 0 4.5 9.5h15a1 1 0 0 0 0-2h-11v-2Zm7 13a1 1 0 0 0 1.707.707l3-3A1 1 0 0 0 19.5 14.5h-15a1 1 0 1 0 0 2h11v2Z" clipRule="evenodd" fillRule="evenodd" fill={swapHovered ? '#FFFFFF99' : '#515151'} /></svg></button>
    {renderSlot({ label: '尾帧', file: lastFile, hovered: lastHovered, setHovered: setLastHovered, wrapperRef: lastWrapperRef, inputRef: lastInputRef, menuOpen: lastMenuOpen, setMenuOpen: setLastMenuOpen, onChange: onLastChange, onAssetPick: onLastAssetPick, isFirst: false })}
  </div>;
}

export default function CreationUploadArea({ genType, refMode, firstFrameFile, lastFrameFile, onFirstChange, onLastChange, onSwap, onFirstAssetPick, onLastAssetPick, renderVoiceControl, uploadProps, disabled = false }) {
  if (genType === 'video' && refMode === 'frame') {
    return <FrameUploader firstFile={firstFrameFile} lastFile={lastFrameFile} onFirstChange={onFirstChange} onLastChange={onLastChange} onSwap={onSwap} onFirstAssetPick={onFirstAssetPick} onLastAssetPick={onLastAssetPick} disabled={disabled} />;
  }
  if (genType === 'dubbing') return renderVoiceControl?.() ?? null;
  return <UploadPlaceholder {...uploadProps} disabled={disabled} />;
}
