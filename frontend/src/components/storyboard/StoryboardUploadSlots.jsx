/**
 * @file StoryboardUploadSlots.jsx
 * @structure-index
 *
 * ─── 组件职责 ───────────────────────────────────────────────
 *   FrameUploadSlot  首帧/尾帧图片上传、资产选择和分镜快捷入口
 *   PanelUploadSlot  参考主体、参考图、参考视频和参考音频的单/多媒体槽位
 *   上传与预览      负责文件校验、业务域上传 API 和资产预选；媒体展示复用 StoryboardMediaPrimitives
 *
 * ─── 依赖边界 ───────────────────────────────────────────────
 *   组件只依赖明确的素材 props、业务域上传 API 和通用资产/预览组件；
 *   不读取 StoryboardPage、GenerateVideoPanel 或 ReferenceMediaEditor 的闭包变量。
 *
 * ─── 迁移边界 ───────────────────────────────────────────────
 *   FrameUploadSlot / PanelUploadSlot 只负责槽位展示、文件校验、上传和资产选择；
 *   素材列表写回、生成请求、Toast 和任务轮询由上层显式回调负责。
 *
 * ─── 更新记录 ───────────────────────────────────────────────
 *   2026-08-17  参考素材选择器接收当前视频模型，Seedance 模型可展示认证素材库
 *   2026-07-16  从生成面板上传区迁移完成；由 ReferenceMediaEditor 直接引入并复用
 *   2026-07-17  抽离媒体内容、删除按钮和首尾帧快捷卡片展示，上传与资产逻辑保持不变
 *   2026-08-10  首尾帧快捷入口支持异步处理后再写入槽位
 *   2026-08-10  首尾帧上传卡片改为三列等宽布局，首帧三个入口可完整撑满一行
 */

import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import AssetPickerModal from '../AssetPickerModal';
import { apiUploadCreationAudio, apiUploadCreationImage, apiUploadCreationVideo } from '../../api/creation';
import { MediaContent, MediaRemoveButton, ShortcutMediaCard } from './StoryboardMediaPrimitives';
import { MediaHoverPreview as StoryboardMediaHoverPreview } from './MainRefCol';
import FileUploadButton from '../ui/FileUploadButton';
import { normalizeImageUrl } from '../../utils/imageUrl';
import { getUploadedImageId, getUploadedImageUrl } from '../../utils/storyboardReferenceAdapter';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif";



function getUploadFn(file) {
  if (file.type.startsWith('video/')) return apiUploadCreationVideo;
  if (file.type.startsWith('audio/')) return apiUploadCreationAudio;
  return apiUploadCreationImage;
}

function getFileLimit(file) {
  if (file.type.startsWith('video/')) return { size: 200 * 1024 * 1024, label: '视频' };
  if (file.type.startsWith('audio/')) return { size: 50 * 1024 * 1024, label: '音频' };
  return { size: 20 * 1024 * 1024, label: '图片' };
}

function toUploadedMedia(result, file) {
  const url = normalizeImageUrl(getUploadedImageUrl(result));
  const assetId = getUploadedImageId(result);
  if (!url) return null;
  return {
    id: assetId || url,
    ...(assetId ? { assetId } : {}),
    url,
    name: file.name,
    type: file.type,
  };
}

export function FrameUploadSlot({ label, media, onUpload, onRemove, shortcutLabel, shortcutImage, shortcutTooltip, onShortcutSelect, shortcutItems = [], projectId }) {
  const fileRef = useRef(null);
  const hoverTimerRef = useRef(null);
  const [hov, setHov] = useState(false);
  const [assetPickerOpen, setAssetPickerOpen] = useState(false);
  const [previewPos, setPreviewPos] = useState(null);

  async function handleFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const limit = getFileLimit(file);
    if (file.size > limit.size) {
      alert(`抱歉，平台暂不支持上传${limit.size / 1024 / 1024}M以上的${limit.label}资源！`);
      return;
    }
    try {
      const result = await getUploadFn(file)({ file, category: 'reference', project_id: projectId });
      const uploadedMedia = toUploadedMedia(result, file);
      if (!uploadedMedia) throw new Error('上传接口未返回素材地址');
      onUpload?.(uploadedMedia);
    } catch {
      alert('上传失败，请重试');
    }
    event.target.value = '';
  }

  function startPreview(event) {
    const { clientX, clientY } = event;
    clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => {
      if (media?.url) setPreviewPos({ x: clientX, y: clientY });
    }, 500);
  }

  function movePreview(event) {
    setPreviewPos((position) => position ? { x: event.clientX, y: event.clientY } : position);
  }

  function stopPreview() {
    clearTimeout(hoverTimerRef.current);
    setPreviewPos(null);
  }

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignSelf: 'stretch' }}>
        {label && <span style={{ fontSize: '14px', lineHeight: '18px', color: 'rgba(255,255,255,0.60)', fontFamily: FONT }}>{label}</span>}
        <div style={{ width: '100%', display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '10px' }}>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
          {media ? (
            <div
              onMouseEnter={startPreview}
              onMouseMove={movePreview}
              onMouseLeave={stopPreview}
              style={{ position: 'relative', width: '100%', aspectRatio: '1', borderRadius: '6px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.12)', boxSizing: 'border-box' }}
            >
              <MediaContent media={media} />
              <MediaRemoveButton onClick={() => { stopPreview(); onRemove?.(); }} />
            </div>
          ) : (
            <div
              onMouseEnter={() => setHov(true)}
              onMouseLeave={() => setHov(false)}
              style={{ width: '100%', aspectRatio: '1', borderRadius: '6px', border: `1px dashed ${hov ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.08)'}`, backgroundColor: '#1D1E1E', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'border-color 0.12s', boxSizing: 'border-box' }}
            >
              <FileUploadButton onClick={() => fileRef.current?.click()}>本地上传</FileUploadButton>
              <FileUploadButton onClick={() => setAssetPickerOpen(true)}>从资产库选择</FileUploadButton>
            </div>
          )}
          {!media && [
            ...(shortcutLabel ? [{ image: shortcutImage, label: shortcutLabel, tooltip: shortcutTooltip, onSelect: onShortcutSelect || onUpload }] : []),
            ...shortcutItems,
          ].map((shortcut, index) => (
            <ShortcutMediaCard
              key={`${shortcut.label || 'shortcut'}-${index}`}
              image={shortcut.image}
              label={shortcut.label}
              tooltip={shortcut.tooltip}
              onSelect={shortcut.onSelect || onUpload}
              enabled={shortcut.enabled}
              stretch
            />
          ))}
        </div>
      </div>
      <AssetPickerModal
        accept="image"
        open={assetPickerOpen}
        onClose={() => setAssetPickerOpen(false)}
        projectId={projectId}
        onConfirm={(assets) => {
          const asset = assets?.[0];
          if (asset) onUpload?.({
            id: asset.id,
            assetId: asset.id,
            url: asset.fileUrl || asset.originalUrl || asset.original_url || asset.thumbnailUrl || asset.thumbnail_url || asset.url || asset.file_url || '',
            name: asset.name || asset.filename || '',
          });
          setAssetPickerOpen(false);
        }}
      />
      {previewPos && media?.url && createPortal(
        <StoryboardMediaHoverPreview url={media.url} isVideo={false} mouseX={previewPos.x} mouseY={previewPos.y} />,
        document.body,
      )}
    </>
  );
}

export function PanelUploadSlot({ label, onUpload, media, onRemove, accept = 'image/*', projectId, model = '', countLabel, mediaList, canAddMore = true, onRemoveItem, onAssetConfirm, onInsert }) {
  const fileRef = useRef(null);
  const hoverTimerRef = useRef(null);
  const [hov, setHov] = useState(false);
  const [addHov, setAddHov] = useState(false);
  const [assetPickerOpen, setAssetPickerOpen] = useState(false);
  const [previewMedia, setPreviewMedia] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const isMultiMode = Array.isArray(mediaList);
  const THUMB = 120;

  async function handleFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const limit = getFileLimit(file);
    if (file.size > limit.size) {
      alert(`抱歉，平台暂不支持上传${limit.size / 1024 / 1024}M以上的${limit.label}资源！`);
      return;
    }
    try {
      const result = await getUploadFn(file)({ file, category: 'reference', project_id: projectId });
      const uploadedMedia = toUploadedMedia(result, file);
      if (!uploadedMedia) throw new Error('上传接口未返回素材地址');
      onUpload?.(uploadedMedia);
    } catch {
      alert('上传失败，请重试');
    }
    event.target.value = '';
  }

  function startPreview(event, item) {
    setMousePos({ x: event.clientX, y: event.clientY });
    clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => {
      if (item?.url) setPreviewMedia({ url: item.url, isVideo: !!item.type?.startsWith('video') });
    }, 500);
  }

  function movePreview(event) {
    setMousePos({ x: event.clientX, y: event.clientY });
  }

  function stopPreview() {
    clearTimeout(hoverTimerRef.current);
    setPreviewMedia(null);
  }

  function renderMedia(item) {
    return <MediaContent media={item} />;
  }

  function renderUploadButtons() {
    return (
      <>
        <FileUploadButton onClick={() => fileRef.current?.click()}>本地上传</FileUploadButton>
        <FileUploadButton onClick={() => setAssetPickerOpen(true)}>从资产库选择</FileUploadButton>
      </>
    );
  }

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignSelf: 'stretch' }}>
        {(label || countLabel) && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '8px' }}>
          {label && <span style={{ fontSize: '14px', lineHeight: '18px', color: 'rgba(255,255,255,0.60)', fontFamily: FONT }}>{label}</span>}
          {countLabel && <span style={{ fontSize: '14px', lineHeight: '18px', color: 'rgba(255,255,255,0.35)', fontFamily: FONT, flexShrink: 0 }}>{countLabel}</span>}
        </div>}
        <input ref={fileRef} type="file" accept={accept} style={{ display: 'none' }} onChange={handleFile} />
        {isMultiMode ? (
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {(mediaList || []).map((item, index) => (
              <div key={item.id || index} onMouseEnter={(event) => startPreview(event, item)} onMouseMove={movePreview} onMouseLeave={stopPreview} style={{ position: 'relative', width: `${THUMB}px`, height: `${THUMB}px`, borderRadius: '6px', overflow: 'hidden', flexShrink: 0, border: '1px solid rgba(255,255,255,0.12)' }}>
                {renderMedia(item)}
                <MediaRemoveButton onClick={() => { stopPreview(); onRemoveItem ? onRemoveItem(index) : onRemove?.(); }} />
              </div>
            ))}
            {canAddMore && <div onMouseEnter={() => setAddHov(true)} onMouseLeave={() => setAddHov(false)} style={{ width: `${THUMB}px`, height: `${THUMB}px`, borderRadius: '6px', flexShrink: 0, border: `1px dashed ${addHov ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.08)'}`, backgroundColor: '#1D1E1E', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'border-color 0.12s', cursor: 'pointer' }}>{renderUploadButtons()}</div>}
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {media ? (
              <div onMouseDown={(event) => { if (onInsert) event.preventDefault(); }} onClick={() => onInsert?.(media)} onMouseEnter={(event) => startPreview(event, media)} onMouseMove={movePreview} onMouseLeave={stopPreview} style={{ position: 'relative', width: '120px', height: '120px', borderRadius: '6px', overflow: 'hidden', flexShrink: 0, border: `1px solid ${onInsert ? 'rgba(255,255,255,0.20)' : 'rgba(255,255,255,0.12)'}`, cursor: onInsert ? 'pointer' : 'default' }}>
                {renderMedia(media)}
                {media.type?.startsWith('audio') && <span style={{ position: 'absolute', bottom: '6px', left: 0, right: 0, paddingInline: '4px', textAlign: 'center', fontSize: '11px', color: 'rgba(255,255,255,0.40)', fontFamily: FONT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{media.name}</span>}
                <MediaRemoveButton onClick={() => { stopPreview(); onRemove?.(); }} />
              </div>
            ) : (
              <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)} style={{ width: '120px', height: '120px', borderRadius: '6px', flexShrink: 0, border: `1px dashed ${hov ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.08)'}`, backgroundColor: '#1D1E1E', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'border-color 0.12s' }}>{renderUploadButtons()}</div>
            )}
          </div>
        )}
      </div>
      <AssetPickerModal
        accept={accept.startsWith('video') ? 'video' : accept.startsWith('image') ? 'image' : accept.startsWith('audio') ? 'audio' : 'all'}
        open={assetPickerOpen}
        onClose={() => setAssetPickerOpen(false)}
        projectId={projectId}
        model={model}
        preSelectedIds={isMultiMode ? (mediaList || []).map((item) => item.assetId || item.id).filter((id) => id && !id.startsWith('blob:')) : (media?.assetId || (!media?.id?.startsWith('blob:') ? media?.id : null)) ? [media.assetId || media.id] : []}
        preSelectedUrls={isMultiMode ? (mediaList || []).map((item) => item.url).filter(Boolean) : (media?.url ? [media.url] : [])}
        onConfirm={(assets) => { onAssetConfirm?.(assets); setAssetPickerOpen(false); }}
      />
      {previewMedia && createPortal(
        <StoryboardMediaHoverPreview url={previewMedia.url} isVideo={previewMedia.isVideo} mouseX={mousePos.x} mouseY={mousePos.y} />,
        document.body,
      )}
    </>
  );
}
