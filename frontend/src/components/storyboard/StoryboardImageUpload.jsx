/**
 * @file StoryboardImageUpload.jsx
 * @structure-index
 *
 * ─── 组件职责 ───────────────────────────────────────────────
 *   ImgUploadBtn       生成面板中的本地上传/资产库选择入口
 *   ImgUploadCard      图片结果列表的上传占位卡
 *   ImgItem            图片结果卡、定稿切换、预览和下载入口
 *   ImgIconBtn         图片/视频结果卡共用的悬浮图标按钮
 *
 * ─── 依赖边界 ───────────────────────────────────────────────
 *   通过 props 接收上传、资产选择、查看、定稿和点击回调；
 *   不读取 StoryboardPage 或生成面板的闭包变量，不调用业务 API。
 */

import { useRef, useState } from 'react';
import AssetPickerModal from '../AssetPickerModal';
import Checkbox from '../Checkbox';
import DotsLoading from '../DotsLoading';
import { normalizeImageUrl } from '../../utils/imageUrl';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif";

export function ImgUploadBtn({ label, onClick }) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setHovered(true)}
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', height: '24px', padding: '0 6px', borderRadius: '6px', cursor: 'pointer',
        background: pressed ? '#222222' : hovered ? '#1A1A1A' : '#161616',
        border: `1px solid ${hovered ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)'}`,
        outline: '1px solid #00000080',
        transition: 'background 100ms, border-color 100ms',
      }}
    >
      <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', color: hovered ? 'rgba(255,255,255,0.8)' : '#FFFFFF66' }}>{label}</span>
    </div>
  );
}

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
        <ImgUploadBtn label="本地上传" onClick={() => fileInputRef.current?.click()} />
        <ImgUploadBtn label="从资产库选择" onClick={() => setAssetPickerOpen(true)} />
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

export function ImgItem({ settled, imageUrl, onView, onSettledChange }) {
  const [hovered, setHovered] = useState(false);
  const borderColor = settled ? '#2DC3E1' : hovered ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)';

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onSettledChange?.(!settled)}
      style={{
        height: '144px', borderRadius: '6px', flexShrink: 0,
        border: `1px solid ${borderColor}`,
        background: '#FFFFFF14', overflow: 'clip', position: 'relative', cursor: 'pointer',
        transition: 'border-color 120ms',
      }}
    >
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {imageUrl
          ? <img src={normalizeImageUrl(imageUrl)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <DotsLoading size={4} color="#2DC3E1" gap={3} />}
      </div>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '8px 10px', backgroundImage: 'linear-gradient(in oklab 180deg, oklab(0% 0 0 / 60%) 0%, oklab(0% 0 0 / 0%) 100%)', display: 'flex', alignItems: 'center', gap: '4px' }}>
        <Checkbox checked={settled} onChange={(event) => { event.stopPropagation(); onSettledChange?.(!settled); }} />
        <span style={{ fontFamily: FONT, fontSize: '14px', lineHeight: '16px', color: '#FFFFFF', fontWeight: settled ? 600 : 500 }}>定稿</span>
      </div>
      {hovered && (
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '6px 8px', backgroundImage: 'linear-gradient(in oklab 0deg, oklab(0% 0 0 / 60%) 0%, oklab(0% 0 0 / 0%) 100%)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
          <ImgIconBtn onClick={(event) => { event.stopPropagation(); onView?.(imageUrl); }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M5.333 2H2.667C2.298 2 2 2.298 2 2.667V5.333" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M5.333 14H2.667C2.298 14 2 13.701 2 13.333V10.667" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M10.667 14H13.333C13.701 14 14 13.701 14 13.333V10.667" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M10.667 2H13.333C13.701 2 14 2.298 14 2.667V5.333" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </ImgIconBtn>
          <ImgIconBtn onClick={(event) => {
            event.stopPropagation();
            if (imageUrl) {
              const link = document.createElement('a');
              link.href = imageUrl;
              link.download = imageUrl.split('/').pop() || 'image.jpg';
              link.click();
            }
          }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 2.667V10" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M5.333 7.333L8 10L10.667 7.333" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M2.667 12H13.333" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </ImgIconBtn>
        </div>
      )}
    </div>
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

