/**
 * @file VideoUploadCard.jsx
 * @structure-index
 *
 * ─── 组件职责 ───────────────────────────────────────────────
 *   视频上传入口卡片     提供本地视频选择和资产库选择的视觉与交互入口
 *   选择结果透传         通过 onUpload/onAssetsSelected 将文件或资产交给业务层
 *
 * ─── 依赖边界 ───────────────────────────────────────────────
 *   只负责卡片交互、文件选择和资产选择弹窗；不调用上传 API、不转换资产数据、
 *   不维护视频结果列表或定稿状态。
 */

import { useRef, useState } from 'react';
import AssetPickerModal from '../AssetPickerModal';
import { ImgUploadBtn } from './StoryboardImageUpload';

export default function VideoUploadCard({
  projectId,
  onUpload,
  onAssetsSelected,
}) {
  const [hovered, setHovered] = useState(false);
  const [assetPickerOpen, setAssetPickerOpen] = useState(false);
  const fileInputRef = useRef(null);

  function handleFileChange(event) {
    const file = event.target.files?.[0];
    if (file) onUpload?.(file);
    event.target.value = '';
  }

  function handleAssetConfirm(assets) {
    onAssetsSelected?.(assets || []);
    setAssetPickerOpen(false);
  }

  return (
    <>
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          height: '144px', borderRadius: '6px', flexShrink: 0,
          border: `1px dashed ${hovered ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.08)'}`,
          background: hovered ? '#222222' : '#1D1E1E',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px',
          transition: 'background 120ms, border-color 120ms',
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
        <ImgUploadBtn label="本地上传" onClick={() => fileInputRef.current?.click()} />
        <ImgUploadBtn label="从资产库选择" onClick={() => setAssetPickerOpen(true)} />
      </div>
      <AssetPickerModal
        accept="video"
        open={assetPickerOpen}
        onClose={() => setAssetPickerOpen(false)}
        projectId={projectId}
        onConfirm={handleAssetConfirm}
      />
    </>
  );
}
