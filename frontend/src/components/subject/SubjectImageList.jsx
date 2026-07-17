/**
 * @file SubjectImageList.jsx
 * @structure-index
 *
 * ─── 组件职责 ───────────────────────────────────────────────────────
 *   SubjectImageList       主体编辑区右侧图片列表与详情弹窗组合
 *   ImageItemUpload        本地上传 / 资产库选择入口
 *   ImageItem              生成图 / 参考图卡片、定稿和快捷操作
 *   ImageActionButton      图片卡片悬浮操作按钮
 *   SubjectImageList       负责图片数据映射与回调透传
 *
 * ─── 依赖边界 ───────────────────────────────────────────────────────
 *   仅依赖主体域展示所需的 AssetPickerModal、MediaDetailModal、Checkbox、DotsLoading
 *   图片上传、下载、定稿和 Toast 由页面通过回调负责；不引用页面、API、Store 或路由
 *
 * ─── 更新记录 ───────────────────────────────────────────────────────
 *   2026-07-15  从 SubjectPage 抽离主体编辑区右侧图片列表及图片卡片
 *   2026-07-15  保持页面负责上传、下载、定稿 API 和 Toast 行为
 */
import { useRef, useState } from 'react';
import AssetPickerModal from '../AssetPickerModal';
import Checkbox from '../Checkbox';
import DotsLoading from '../DotsLoading';
import MediaDetailModal from '../MediaDetailModal';
import { Button, IconButton } from '../ui';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif";

function UploadButton({ label, onClick }) {
  return (
    <Button
      type="button"
      variant="secondary"
      size="small"
      className="!h-6 !px-[6px] !rounded-[6px] !border-white/10 !bg-[#161616] !shadow-none hover:!border-white/20 hover:!bg-[#1A1A1A] active:!bg-[#222222]"
      contentClassName="!text-[12px] !leading-4 !font-normal !text-white/40 group-hover:!text-white/80"
      onClick={onClick}
    >
      {label}
    </Button>
  );
}

function ImageItemUpload({ onUpload, projectId }) {
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
      <AssetPickerModal
        accept="image"
        open={assetPickerOpen}
        onClose={() => setAssetPickerOpen(false)}
        onConfirm={(ids) => {
          if (ids.length > 0) onUpload?.(ids[0]);
          setAssetPickerOpen(false);
        }}
        projectId={projectId}
      />
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
        <UploadButton label="本地上传" onClick={() => fileInputRef.current?.click()} />
        <UploadButton label="从资产库选择" onClick={() => setAssetPickerOpen(true)} />
      </div>
    </>
  );
}

function FullscreenIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M5.333 2H2.667C2.298 2 2 2.298 2 2.667V5.333" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5.333 14H2.667C2.298 14 2 13.701 2 13.333V10.667" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10.667 14H13.333C13.701 14 14 13.701 14 13.333V10.667" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10.667 2H13.333C13.701 2 14 2.298 14 2.667V5.333" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M8 2.667V10" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5.333 7.333L8 10L10.667 7.333" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2.667 12H13.333" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ImageActionButton({ children, ariaLabel, onClick }) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  return (
    <IconButton
      type="button"
      size="small"
      variant="secondary"
      icon={children}
      aria-label={ariaLabel}
      className="!h-7 !w-7 !rounded-md !border-0 !p-0 !shadow-none"
      style={{
        backgroundColor: pressed ? 'rgba(255,255,255,0.18)' : hovered ? 'rgba(255,255,255,0.12)' : 'transparent',
        transition: 'background 100ms',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onClick={onClick}
    />
  );
}

function ImageItem({ settled, imageUrl, onView, onSettledChange, onDownload }) {
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
          ? <img src={imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <DotsLoading size={4} color="#2DC3E1" gap={3} />}
      </div>

      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '8px 10px', backgroundImage: 'linear-gradient(in oklab 180deg, oklab(0% 0 0 / 60%) 0%, oklab(0% 0 0 / 0%) 100%)', display: 'flex', alignItems: 'center', gap: '4px' }}>
        <Checkbox checked={settled} onChange={(event) => { event.stopPropagation(); onSettledChange?.(!settled); }} />
        <span style={{ fontFamily: FONT, fontSize: '14px', lineHeight: '16px', color: '#FFFFFF', fontWeight: settled ? 600 : 500 }}>定稿</span>
      </div>

      {hovered && (
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '6px 8px', backgroundImage: 'linear-gradient(in oklab 0deg, oklab(0% 0 0 / 60%) 0%, oklab(0% 0 0 / 0%) 100%)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
          <ImageActionButton ariaLabel="查看图片" onClick={(event) => { event.stopPropagation(); onView?.(imageUrl); }}>
            <FullscreenIcon />
          </ImageActionButton>
          <ImageActionButton ariaLabel="下载图片" onClick={(event) => { event.stopPropagation(); onDownload?.(); }}>
            <DownloadIcon />
          </ImageActionButton>
        </div>
      )}
    </div>
  );
}

export default function SubjectImageList({
  projectId,
  subject,
  generatedImages = [],
  promptText,
  selectedModel,
  selectedRatio,
  selectedResolution,
  refImagesForModal = [],
  mediaDetailOpen = false,
  mediaDetailActiveIdx = 0,
  onOpenDetail,
  onCloseDetail,
  onUpload,
  onDownload,
  onSettledChange,
}) {
  const images = generatedImages.filter((image) => image.url).map((image) => ({
    id: image.id,
    url: image.url,
    fileUrl: image.rawUrl ?? image.url,
    is_primary: image.settled ?? false,
    prompt: promptText,
    model: selectedModel,
    ratio: selectedRatio,
    resolution: selectedResolution,
    refImages: image.refImages?.length > 0 ? image.refImages : refImagesForModal,
  }));

  return (
    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', paddingLeft: '12px', paddingRight: '24px', paddingTop: '8px', paddingBottom: '8px', background: '#161616', height: '100%', boxSizing: 'border-box' }}>
      {mediaDetailOpen && (
        <MediaDetailModal
          mode="image"
          images={images}
          name={subject?.name ?? ''}
          description={subject?.desc ?? ''}
          showDelete={false}
          showDownload={true}
          activeIndex={mediaDetailActiveIdx}
          onClose={onCloseDetail}
          onDownload={onDownload}
        />
      )}
      <ImageItemUpload projectId={projectId} onUpload={onUpload} />
      {generatedImages.map((image, index) => (
        <ImageItem
          key={image.id ?? image.url + index}
          imageUrl={image.url}
          settled={image.settled}
          onView={() => onOpenDetail?.(index)}
          onDownload={() => onDownload?.(image.id)}
          onSettledChange={(newSettled) => onSettledChange?.(image, index, newSettled)}
        />
      ))}
    </div>
  );
}

