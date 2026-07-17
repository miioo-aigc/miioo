import { useRef, useState } from 'react';
import DotsLoading from '../DotsLoading';
import MediaDetailModal from '../MediaDetailModal';
import ShotViewerModal from '../ShotViewerModal';
import { normalizeImageUrl } from '../../utils/imageUrl';

/**
 * @file MediaCol.jsx
 * @structure-index
 *
 *   MediaCol                 分镜图/视频卡片、上传入口、悬停操作和详情弹窗
 *   MediaColWrapper          媒体列标题、尺寸和边框布局容器
 *
 *   页面级 API、生成任务、轮询、缓存和 Toast 通过 props 传入，组件不读取
 *   StoryboardPage 的闭包变量；媒体业务状态仅保留卡片内部的展示弹窗状态。
 */

const FONT = '"Alibaba PuHuiTi 2.0", system-ui, sans-serif';

const IconImagePlaceholder = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <rect x="2" y="3" width="12" height="10" rx="2" stroke="#848484" strokeWidth="1.2" />
    <circle cx="5.5" cy="6.5" r="1.5" stroke="#848484" strokeWidth="1.2" />
    <path d="M2 11L5 8L7.5 10.5L10 8L14 11" stroke="#848484" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IconVideoPlaceholder = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <rect x="2" y="3" width="9" height="10" rx="2" stroke="#848484" strokeWidth="1.2" />
    <path d="M11 6.5L14 5V11L11 9.5V6.5Z" stroke="#848484" strokeWidth="1.2" strokeLinejoin="round" />
  </svg>
);

function MediaIconBtn({ children, onClick }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: '24px',
        height: '24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '4px',
        backgroundColor: hovered ? 'rgba(255,255,255,0.20)' : 'rgba(0,0,0,0.50)',
        cursor: 'pointer',
        flexShrink: 0,
        transition: 'background-color 0.10s',
      }}
    >
      {children}
    </div>
  );
}

/**
 * 分镜图/视频媒体卡片。
 *
 * 组件只负责媒体展示、文件选择、预览入口和详情弹窗；上传、生成、任务
 * 轮询及页面状态更新由 StoryboardPage 通过 props 提供，避免依赖页面闭包。
 */
export default function MediaCol({
  media,
  onUpload,
  accept,
  isVideo,
  onAIGenerate,
  shotMeta,
  generating,
  generatedImages = [],
  genRefImages = [],
}) {
  const [hovered, setHovered] = useState(false);
  const [viewerShot, setViewerShot] = useState(null);
  const [imageDetailOpen, setImageDetailOpen] = useState(false);
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const isEmpty = !media;

  function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    if (!isVideo && file.size > 20 * 1024 * 1024) {
      alert('抱歉，平台暂不支持上传20M以上的图片资源！');
      event.target.value = '';
      return;
    }
    const url = URL.createObjectURL(file);
    onUpload?.({ id: url, url, name: file.name, type: file.type, file });
    event.target.value = '';
  }

  function handleMouseEnter() {
    setHovered(true);
    if (isVideo && !isEmpty && !generating && videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
    }
  }

  function handleMouseLeave() {
    setHovered(false);
    if (isVideo && !isEmpty && !generating && videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  }

  const detailSource = media?.source || 'local-upload';
  const detailIsAi = detailSource === 'ai-generated';
  const detailImages = generatedImages.length > 0
    ? generatedImages.map((image) => ({
        id: image.id ?? image.url,
        url: image.url,
        fileUrl: image.url,
        is_primary: image.settled ?? (image.url === media?.url),
        prompt: image.prompt || (detailIsAi ? shotMeta?.prompt : undefined),
        model: image.model || (detailIsAi ? shotMeta?.model : undefined),
        resolution: image.resolution || (detailIsAi ? shotMeta?.resolution : undefined),
        created_at: image.created_at,
        refImages: image.refImages?.length > 0 ? image.refImages : genRefImages,
      }))
    : [{
        id: media?.id ?? media?.url,
        url: media?.url,
        fileUrl: media?.url,
        is_primary: media?.settled ?? true,
        prompt: detailIsAi ? shotMeta?.prompt : undefined,
        model: detailIsAi ? shotMeta?.model : undefined,
        resolution: detailIsAi ? shotMeta?.resolution : undefined,
        created_at: media?.created_at,
        refImages: genRefImages,
      }];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignSelf: 'stretch', flex: 1 }}>
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />

      <div
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={() => { if (!isEmpty || generating) onAIGenerate?.(); }}
        style={{
          flex: 1,
          minHeight: 0,
          alignSelf: 'stretch',
          borderRadius: '6px',
          position: 'relative',
          overflow: 'hidden',
          cursor: (isEmpty && !generating) ? 'default' : 'pointer',
          ...(isEmpty ? {
            backgroundColor: '#1D1E1E',
            border: '1px dashed rgba(255,255,255,0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          } : {
            border: `1px solid ${hovered ? 'rgba(45,195,225,0.50)' : 'rgba(255,255,255,0.06)'}`,
            transition: 'border-color 150ms',
          }),
        }}
      >
        {generating && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1D1E1E', borderRadius: '6px', zIndex: 2 }}>
            <DotsLoading size={4} color="#2DC3E1" gap={3} />
          </div>
        )}

        {!isEmpty && !generating && (
          isVideo ? (
            <video
              src={normalizeImageUrl(media.url)}
              ref={videoRef}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
              muted
              playsInline
            />
          ) : (
            <img src={normalizeImageUrl(media.url)} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
          )
        )}

        {!isEmpty && hovered && (
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            padding: '6px 6px',
            backgroundImage: 'linear-gradient(in oklab 0deg, oklab(0% 0 0 / 60%) 0%, oklab(0% 0 0 / 0%) 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px',
          }}>
            <MediaIconBtn onClick={(event) => {
              event.stopPropagation();
              if (!media?.url) return;
              if (isVideo) {
                setViewerShot({
                  videoUrl: media.url,
                  filename: media.name,
                  label: shotMeta?.label,
                  prompt: shotMeta?.prompt,
                  model: shotMeta?.model,
                  resolution: shotMeta?.resolution,
                  duration: shotMeta?.duration,
                  aspectRatio: shotMeta?.aspectRatio,
                  finalized: shotMeta?.finalized,
                });
              } else {
                setImageDetailOpen(true);
              }
            }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M5.333 2H2.667C2.298 2 2 2.298 2 2.667V5.333" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M5.333 14H2.667C2.298 14 2 13.701 2 13.333V10.667" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M10.667 14H13.333C13.701 14 14 13.701 14 13.333V10.667" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M10.667 2H13.333C13.701 2 14 2.298 14 2.667V5.333" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </MediaIconBtn>
            <MediaIconBtn onClick={(event) => {
              event.stopPropagation();
              if (!media?.url) return;
              const anchor = document.createElement('a');
              anchor.href = media.url;
              anchor.download = media.name || 'download';
              anchor.click();
            }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M8 2.667V10" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M5.333 7.333L8 10L10.667 7.333" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M2.667 12H13.333" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </MediaIconBtn>
          </div>
        )}

        {isEmpty && !hovered && !generating && (
          <div style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            {isVideo ? <IconVideoPlaceholder /> : <IconImagePlaceholder />}
          </div>
        )}

        {isEmpty && hovered && !generating && (
          <div
            onMouseDown={(event) => { event.stopPropagation(); onAIGenerate?.(); }}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '24px', paddingInline: '8px', borderRadius: '6px', backgroundColor: '#2DC3E1', border: '1px solid #FFFFFF33', outline: '1px solid rgba(0,0,0,0.50)', cursor: 'pointer', fontSize: '12px', color: '#090909', fontFamily: FONT, animation: 'slideUpBounce 300ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards', animationDelay: '0ms', opacity: 0, whiteSpace: 'nowrap' }}
          >
            {isVideo ? '创作视频' : '创作图片'}
          </div>
        )}
      </div>

      {viewerShot && <ShotViewerModal shot={viewerShot} onClose={() => setViewerShot(null)} />}
      {imageDetailOpen && (
        <MediaDetailModal
          mode="image"
          source={detailSource}
          images={detailImages}
          name={shotMeta?.label ?? ''}
          shotNumber={shotMeta?.label ?? ''}
          generatedAt={detailImages[0]?.created_at || null}
          showDelete={false}
          showDownload
          activeIndex={0}
          onClose={() => setImageDetailOpen(false)}
          onDownload={(imageId, fileUrl) => {
            const anchor = document.createElement('a');
            anchor.href = fileUrl || media?.url;
            anchor.download = `storyboard-image-${imageId || 'download'}.jpg`;
            anchor.target = '_blank';
            anchor.rel = 'noopener noreferrer';
            document.body.appendChild(anchor);
            anchor.click();
            document.body.removeChild(anchor);
          }}
        />
      )}
    </div>
  );
}

export function MediaColWrapper({
  label,
  media,
  onUpload,
  accept,
  isVideo,
  isLast = false,
  onAIGenerate,
  shotMeta,
  generating,
  generatedImages = [],
  genRefImages = [],
}) {
  return (
    <div style={{
      width: 'calc(15% - 1px)',
      minWidth: '160px',
      maxWidth: '220px',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      padding: '12px',
      borderRight: isLast ? 'none' : '1px solid rgba(255,255,255,0.08)',
      alignSelf: 'stretch',
    }}>
      <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.60)', fontFamily: FONT, flexShrink: 0 }}>
        {label}
      </span>
      <MediaCol
        media={media}
        onUpload={onUpload}
        accept={accept}
        isVideo={isVideo}
        onAIGenerate={onAIGenerate}
        shotMeta={shotMeta}
        generating={generating}
        generatedImages={generatedImages}
        genRefImages={genRefImages}
      />
    </div>
  );
}
