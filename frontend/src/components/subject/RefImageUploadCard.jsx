/**
 * @file RefImageUploadCard.jsx
 * @structure-index
 *
 * ─── 组件职责 ───────────────────────────────────────────────────────
 *   RefImageUploadCard 提供参考图区域的上传/资产选择视觉卡片
 *
 * ─── 依赖边界 ───────────────────────────────────────────────────────
 *   只接收点击回调，不处理文件、API、资产选择或主体状态
 */
import { useState } from 'react';
import FileUploadButton from '../ui/FileUploadButton';

export default function RefImageUploadCard({ onLocalUpload, onAssetPick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} style={{ width: '120px', height: '120px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', borderRadius: '8px', background: hovered ? '#222222' : '#1D1E1E', border: `1px dashed ${hovered ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)'}`, gap: '8px', transition: 'background 120ms, border-color 120ms' }}>
      <FileUploadButton onClick={onLocalUpload}>本地上传</FileUploadButton>
      <FileUploadButton onClick={onAssetPick}>从资产库选择</FileUploadButton>
    </div>
  );
}
