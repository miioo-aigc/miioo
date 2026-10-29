/**
 * Seedance 素材库文件夹详情。
 * 负责图片/视频展示和上传入口，数据请求与页面状态由父面板编排。
 * 2026-10-29 上传入口复用 CreateCard，保留 242×160px 尺寸及上传菜单。
 */

import { useEffect, useRef, useState } from 'react';
import SeedanceAssetCard from './SeedanceAssetCard';
import { Button, CreateCard } from '../ui';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif";

export default function SeedanceFolderDetail({ folder, assets = [], loading = false, error = '', onRetry, uploading = false, onBack, onUpload, onSelectFromLibrary, onPreview, onDelete }) {
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

      {loading && <div role="status" className="text-text-secondary text-font-size-14">正在读取素材…</div>}
      {error && !loading && <div role="alert" className="text-text-secondary text-font-size-14">{error} <Button onClick={onRetry}>重试</Button></div>}
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
          <CreateCard
            label="上传"
            className="h-full"
            busy={uploading}
            disabled={loading}
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
          />
          {uploadMenuOpen && !uploading && !loading ? (
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
        {assets.map((asset) => <SeedanceAssetCard key={asset.id} asset={asset} onPreview={onPreview} onDelete={onDelete} />)}
        </div>
      </div>
    </div>
  );
}
