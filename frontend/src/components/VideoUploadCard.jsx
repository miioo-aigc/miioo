import { useState, useRef, memo } from 'react';
import ImgUploadBtn from './ImgUploadBtn';
import AssetPickerModal from './AssetPickerModal';

function VideoUploadCard({ onUpload, projectId, onAssetSelect }) {
  const [hovered, setHovered] = useState(false);
  const [assetPickerOpen, setAssetPickerOpen] = useState(false);
  const fileInputRef = useRef(null);
  return (
    <>
      <div onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
        style={{ height: '144px', borderRadius: '6px', flexShrink: 0, border: `1px dashed ${hovered ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.08)'}`, background: hovered ? '#222222' : '#1D1E1E', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'background 120ms, border-color 120ms' }}>
        <input ref={fileInputRef} type="file" accept="video/*" style={{ display: 'none' }} onChange={(e) => { if (e.target.files?.[0]) onUpload?.(e.target.files[0]); e.target.value = ''; }} />
        <ImgUploadBtn label="本地上传" onClick={() => fileInputRef.current?.click()} />
        <ImgUploadBtn label="从资产库选择" onClick={() => setAssetPickerOpen(true)} />
      </div>
      <AssetPickerModal accept="video" open={assetPickerOpen} onClose={() => setAssetPickerOpen(false)} projectId={projectId} onConfirm={(assets) => { if (onAssetSelect) onAssetSelect(assets); setAssetPickerOpen(false); }} />
    </>
  );
}
export default memo(VideoUploadCard);
