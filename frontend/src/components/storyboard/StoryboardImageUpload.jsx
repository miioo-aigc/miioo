/**
 * @file StoryboardImageUpload.jsx
 * @structure-index
 *
 * ─── 组件职责 ───────────────────────────────────────────────
 *   FileUploadButton   生成面板中的本地上传/资产库选择入口
 *   ImgUploadCard      图片结果列表的上传占位卡
 *   ImgIconBtn         图片/视频结果卡共用的悬浮图标按钮
 *
 * ─── 依赖边界 ───────────────────────────────────────────────
 *   通过 props 接收上传、资产选择、查看、定稿和点击回调；
 *   不读取 StoryboardPage 或生成面板的闭包变量，不调用业务 API。
 */

import { useRef, useState } from 'react';
import AssetPickerModal from '../AssetPickerModal';
import FileUploadButton from '../ui/FileUploadButton';

// 分镜内所有“本地上传/从资产库选择”入口统一使用同一视觉原子；业务文件选择仍由调用方负责。

export function ImgUploadCard({ onUpload, projectId, onAssetSelect }) {
  const [hovered, setHovered] = useState(false);
  const [assetPickerOpen, setAssetPickerOpen] = useState(false);
  const fileInputRef = useRef(null);

  function handleFileChange(event) {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 20 * 1024 * 1024) {
        alert('抱歉，平台暂不支持上传20M以上的图片资源！');
        event.target.value = '';
        return;
      }
      onUpload?.(file);
    }
    event.target.value = '';
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
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
        <FileUploadButton onClick={() => fileInputRef.current?.click()}>本地上传</FileUploadButton>
        <FileUploadButton onClick={() => setAssetPickerOpen(true)}>从资产库选择</FileUploadButton>
      </div>
      <AssetPickerModal
        accept="image"
        open={assetPickerOpen}
        onClose={() => setAssetPickerOpen(false)}
        projectId={projectId}
        onConfirm={(assets) => {
          onAssetSelect?.(assets);
          setAssetPickerOpen(false);
        }}
      />
    </>
  );
}

export function ImgIconBtn({ children, onClick }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: '4px', backgroundColor: hovered ? 'rgba(255,255,255,0.20)' : 'rgba(0,0,0,0.50)',
        cursor: 'pointer', flexShrink: 0, transition: 'background-color 0.10s',
      }}
    >
      {children}
    </div>
  );
}
