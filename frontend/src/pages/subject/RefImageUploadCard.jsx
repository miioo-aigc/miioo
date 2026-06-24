 import { useState } from "react";
 import RefImageItem from "./RefImageItem";
 import UploadBtn from './UploadBtn';

export default 
function RefImageUploadCard({ onLocalUpload, onAssetPick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: '120px', height: '120px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', borderRadius: '8px',
        background: hovered ? '#222222' : '#1D1E1E',
        border: `1px dashed ${hovered ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)'}`,
        gap: '8px', transition: 'background 120ms, border-color 120ms',
      }}
    >
      <UploadBtn label="本地上传" onClick={onLocalUpload} />
      <UploadBtn label="从资产库选择" onClick={onAssetPick} />
    </div>
  );
}
