/**
 * Seedance 素材库文件夹详情。
 * 负责图片/视频展示和上传入口，数据请求与页面状态由父面板编排。
 */

import { useEffect, useRef, useState } from 'react';
import SeedanceAssetCard from './SeedanceAssetCard';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif";

function UploadIcon() {
  return (
    <svg viewBox="0 0 102.4 102.4" xmlns="http://www.w3.org/2000/svg" width="20" height="20" aria-hidden="true">
      <path d="M79.997 76.8H22.397a3.2 3.2 0 0 1-3.2-3.2v-25.6a3.2 3.2 0 0 1 3.2-3.2h6.4a3.2 3.2 0 1 1 0 6.4H25.597v19.2h51.2v-19.2h-3.2a3.2 3.2 0 0 1 0-6.4h6.4a3.2 3.2 0 0 1 3.2 3.2v25.6a3.2 3.2 0 0 1-3.2 3.2z m-25.6-40.272v24.275a3.2 3.2 0 0 1-6.4 0v-24.288l-4.128 4.128a3.2 3.2 0 0 1-4.512-4.512l9.408-9.408a3.194 3.194 0 0 1 1.981-1.088 3.197 3.197 0 0 1 2.723 0.896l9.6 9.6A3.2 3.2 0 0 1 60.797 41.6a3.2 3.2 0 0 1-2.272-0.928L54.397 36.528z" fill="#FFFFFFCC" />
    </svg>
  );
}

export default function SeedanceFolderDetail({ folder, assets = [], loading = false, uploading = false, onBack, onUpload, onSelectFromLibrary, onPreview, onDelete }) {
  const inputRef = useRef(null);
  const uploadMenuRef = useRef(null);
  const [uploadMenuOpen, setUploadMenuOpen] = useState(false);
  const [uploadMenuPosition, setUploadMenuPosition] = useState({ x: 0, y: 0 });
  const [hoveredUploadMenuItem, setHoveredUploadMenuItem] = useState(null);
  const [pressedUploadMenuItem, setPressedUploadMenuItem] = useState(null);

  useEffect(() => {
    if (!uploadMenuOpen) return undefined;
    const handlePointerDown = (event) => {
      if (!uploadMenuRef.current?.contains(event.target)) setUploadMenuOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [uploadMenuOpen]);

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) onUpload?.(file);
  };

  return (
    <div
      style={{
        flex: '1 1 0%',
        minHeight: 0,
        overflow: 'auto',
        padding: '0 24px 8px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        fontFamily: FONT,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', flexShrink: 0 }}>
        <button
          type="button"
          onClick={onBack}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: '#FFFFFF66' }}
        >
          返回/
        </button>
        <span style={{ fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: '#FFFFFF' }}>{folder.name}</span>
      </div>

      <div style={{ position: 'relative', flex: '1 1 0%', minHeight: '200px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignContent: 'flex-start' }}>
        <input
          ref={inputRef}
          accept=".jpeg,.jpg,.png,.webp,.gif,.heic,.mp4,.mov,.mp3,.wav,image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,audio/mpeg,audio/wav"
          type="file"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
        <div ref={uploadMenuRef} style={{ position: 'relative', width: '242px', height: '160px', flexShrink: 0 }}>
          <button
            type="button"
            disabled={uploading}
            aria-haspopup="menu"
            aria-expanded={uploadMenuOpen}
            onClick={(event) => {
              if (uploadMenuOpen) {
                setUploadMenuOpen(false);
                return;
              }
              const menuWidth = 168;
              const menuHeight = 82;
              const gap = 8;
              setUploadMenuPosition({
                x: Math.min(event.clientX + gap, window.innerWidth - menuWidth - gap),
                y: Math.min(event.clientY + gap, window.innerHeight - menuHeight - gap),
              });
              setUploadMenuOpen(true);
            }}
            style={{ width: '100%', height: '100%', borderRadius: '8px', border: '1px dashed rgba(255,255,255,0.2)', background: uploadMenuOpen ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)', cursor: uploading ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', transition: 'background 0.15s', opacity: uploading ? 0.65 : 1, fontFamily: FONT }}
            onMouseEnter={(event) => { if (!uploading) event.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
            onMouseLeave={(event) => { if (!uploadMenuOpen) event.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
          >
            <UploadIcon />
            <span style={{ fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: '#FFFFFFCC', flexShrink: 0 }}>上传</span>
          </button>
          {uploadMenuOpen && !uploading ? (
            <div role="menu" style={{ position: 'fixed', top: `${uploadMenuPosition.y}px`, left: `${uploadMenuPosition.x}px`, zIndex: 1202, minWidth: '148px', padding: '4px', border: '1px solid #FFFFFF14', borderRadius: '8px', background: '#1C1C1C', boxShadow: '0 8px 24px rgba(0,0,0,0.45)' }}>
              <button
                type="button"
                role="menuitem"
                onClick={() => { setUploadMenuOpen(false); inputRef.current?.click(); }}
                onMouseEnter={() => setHoveredUploadMenuItem('local')}
                onMouseLeave={() => { setHoveredUploadMenuItem(null); setPressedUploadMenuItem(null); }}
                onMouseDown={() => setPressedUploadMenuItem('local')}
                onMouseUp={() => setPressedUploadMenuItem(null)}
                style={{ display: 'block', width: '100%', height: '32px', padding: '0 12px', border: 0, borderRadius: '6px', background: pressedUploadMenuItem === 'local' ? '#FFFFFF1A' : hoveredUploadMenuItem === 'local' ? '#FFFFFF0F' : 'transparent', color: hoveredUploadMenuItem === 'local' ? '#FFFFFF' : '#FFFFFFCC', cursor: 'pointer', textAlign: 'left', fontFamily: FONT, fontSize: '14px', outline: 'none', transition: 'background 100ms, color 100ms' }}
                onFocus={(event) => { event.currentTarget.style.boxShadow = '0 0 0 2px rgba(45,195,225,0.6) inset'; }}
                onBlur={(event) => { event.currentTarget.style.boxShadow = 'none'; }}
              >从本地上传</button>
              <button
                type="button"
                role="menuitem"
                onClick={() => { setUploadMenuOpen(false); onSelectFromLibrary?.(); }}
                onMouseEnter={() => setHoveredUploadMenuItem('library')}
                onMouseLeave={() => { setHoveredUploadMenuItem(null); setPressedUploadMenuItem(null); }}
                onMouseDown={() => setPressedUploadMenuItem('library')}
                onMouseUp={() => setPressedUploadMenuItem(null)}
                style={{ display: 'block', width: '100%', height: '32px', padding: '0 12px', border: 0, borderRadius: '6px', background: pressedUploadMenuItem === 'library' ? '#FFFFFF1A' : hoveredUploadMenuItem === 'library' ? '#FFFFFF0F' : 'transparent', color: hoveredUploadMenuItem === 'library' ? '#FFFFFF' : '#FFFFFFCC', cursor: 'pointer', textAlign: 'left', fontFamily: FONT, fontSize: '14px', outline: 'none', transition: 'background 100ms, color 100ms' }}
                onFocus={(event) => { event.currentTarget.style.boxShadow = '0 0 0 2px rgba(45,195,225,0.6) inset'; }}
                onBlur={(event) => { event.currentTarget.style.boxShadow = 'none'; }}
              >从资产库选择</button>
            </div>
          ) : null}
        </div>
        {!loading && assets.map((asset) => <SeedanceAssetCard key={asset.id} asset={asset} onPreview={onPreview} onDelete={onDelete} />)}
        </div>
      </div>
    </div>
  );
}
