/**
 * @file ReferenceMediaEditor.jsx
 * @structure-index
 *
 * ─── 组件职责 ───────────────────────────────────────────────
 *   全能参考编辑       管理主体、图片、视频和音频参考素材槽位
 *   首尾帧编辑         管理首帧、尾帧和当前/下一分镜快捷入口
 *   事件适配           将本地上传、资产选择和素材删除转换为显式回调
 *
 * ─── 依赖边界 ───────────────────────────────────────────────
 *   通过 props 接收素材状态、模型能力和业务回调；直接引入 StoryboardUploadSlots；
 *   不直接调用上传 API，不读取 GenerateVideoPanel 或 StoryboardPage 的闭包变量。
 *   仅把上传、资产选择、删除和插入提示转换为显式回调。
 *
 * ─── 更新记录 ───────────────────────────────────────────────
 *   2026-07-16  上传槽位改为业务域内直接引入，移除页面级组件转发边界；保留素材状态与回调契约
 */

import { useCallback } from 'react';
import { normalizeImageUrl } from '../../utils/imageUrl';
import { FrameUploadSlot, PanelUploadSlot } from './StoryboardUploadSlots';

export default function ReferenceMediaEditor({
  tab,
  projectId,
  shot,
  nextShot,
  showRefSubjects,
  showRefImages,
  showRefVideo,
  showRefAudio,
  maxRefImages,
  imageCountLabel,
  videoCountLabel,
  audioCountLabel,
  canAddImage,
  refSubjects = [],
  refImages = [],
  refVideo = null,
  refAudio = null,
  refFirstFrame = null,
  refLastFrame = null,
  onRefSubjectsChange,
  onRefImagesChange,
  onRefVideoChange,
  onRefAudioChange,
  onRefFirstFrameChange,
  onRefLastFrameChange,
  onReferenceMediaUpload,
  buildRefFromAsset,
  onInsertReference,
}) {
  const uploadBlobMedia = useCallback(async (media, type, onUploaded) => {
    if (!media?.id?.startsWith('blob:')) {
      onUploaded(media);
      return;
    }

    try {
      const response = await fetch(media.url);
      const blob = await response.blob();
      const file = new File([blob], media.name, { type: media.type });
      const uploaded = await onReferenceMediaUpload?.(file, type);
      if (uploaded) onUploaded(uploaded);
    } catch {
      // 上传失败提示由 GenerateVideoPanel 的业务回调统一处理。
    }
  }, [onReferenceMediaUpload]);

  const appendSubject = useCallback((media) => {
    uploadBlobMedia(media, 'image', (uploaded) => {
      onRefSubjectsChange?.((prev) => [...prev, uploaded]);
    });
  }, [onRefSubjectsChange, uploadBlobMedia]);

  const appendImage = useCallback((media) => {
    uploadBlobMedia(media, 'image', (uploaded) => {
      onRefImagesChange?.((prev) => [...prev, uploaded]);
    });
  }, [onRefImagesChange, uploadBlobMedia]);

  const appendVideo = useCallback((media) => {
    uploadBlobMedia(media, 'video', onRefVideoChange);
  }, [onRefVideoChange, uploadBlobMedia]);

  const appendAudio = useCallback((media) => {
    uploadBlobMedia(media, 'audio', onRefAudioChange);
  }, [onRefAudioChange, uploadBlobMedia]);

  return (
    <>
      {tab === 'all' && (
        <>
          {showRefSubjects && (
            <PanelUploadSlot
              projectId={projectId}
              label="参考主体"
              countLabel={imageCountLabel}
              accept="image/*"
              mediaList={refSubjects}
              canAddMore={canAddImage}
              onUpload={appendSubject}
              onRemove={() => onRefSubjectsChange?.([])}
              onRemoveItem={(index) => onRefSubjectsChange?.((prev) => prev.filter((_, itemIndex) => itemIndex !== index))}
              onAssetConfirm={(selectedAssets) => {
                if (!selectedAssets?.length) return;
                const newItems = selectedAssets.map(buildRefFromAsset);
                onRefSubjectsChange?.((prev) => {
                  const merged = [...prev, ...newItems];
                  return maxRefImages != null ? merged.slice(0, maxRefImages) : merged;
                });
              }}
            />
          )}

          {showRefImages && (
            <PanelUploadSlot
              projectId={projectId}
              label="参考图"
              countLabel={imageCountLabel}
              accept="image/*"
              mediaList={refImages}
              canAddMore={canAddImage}
              onUpload={appendImage}
              onRemove={() => onRefImagesChange?.([])}
              onRemoveItem={(index) => onRefImagesChange?.((prev) => prev.filter((_, itemIndex) => itemIndex !== index))}
              onAssetConfirm={(selectedAssets) => {
                if (!selectedAssets?.length) return;
                const newItems = selectedAssets.map((asset) => ({
                  id: asset.id,
                  assetId: asset.id,
                  url: normalizeImageUrl(asset.fileUrl || asset.originalUrl || asset.original_url || asset.thumbnailUrl || asset.thumbnail_url || asset.url || asset.file_url),
                  name: asset.name || asset.filename || '',
                }));
                onRefImagesChange?.((prev) => {
                  const merged = [...prev, ...newItems];
                  return maxRefImages != null ? merged.slice(0, maxRefImages) : merged;
                });
              }}
            />
          )}

          {showRefVideo && (
            <PanelUploadSlot
              projectId={projectId}
              label="参考视频"
              countLabel={videoCountLabel}
              accept="video/mp4,video/quicktime"
              media={refVideo}
              onUpload={appendVideo}
              onRemove={() => onRefVideoChange?.(null)}
              onAssetConfirm={(assets) => {
                const asset = assets?.[0];
                if (!asset) return;
                onRefVideoChange?.({ id: asset.id, url: asset.fileUrl || asset.url, name: asset.name || '参考视频', type: 'video/mp4' });
              }}
              onInsert={(media) => onInsertReference?.(media, 'video')}
            />
          )}

          {showRefAudio && (
            <PanelUploadSlot
              projectId={projectId}
              label="参考音频"
              countLabel={audioCountLabel}
              accept="audio/mpeg,audio/wav"
              media={refAudio}
              onUpload={appendAudio}
              onRemove={() => onRefAudioChange?.(null)}
              onAssetConfirm={(assets) => {
                const asset = assets?.[0];
                if (!asset) return;
                onRefAudioChange?.({ id: asset.id, url: asset.fileUrl || asset.url, name: asset.name || '参考音频', type: 'audio/mpeg' });
              }}
              onInsert={(media) => onInsertReference?.(media, 'audio')}
            />
          )}
        </>
      )}

      {tab === 'frame' && (
        <>
          <FrameUploadSlot
            label="首帧图"
            media={refFirstFrame}
            onUpload={onRefFirstFrameChange}
            onRemove={() => onRefFirstFrameChange?.(null)}
            shortcutLabel="使用当前分镜图"
            shortcutImage={shot?.storyboardImage ?? null}
            shortcutTooltip="当前分镜尚未生成分镜图"
            projectId={projectId}
          />
          <FrameUploadSlot
            label="尾帧图（可选）"
            media={refLastFrame}
            onUpload={onRefLastFrameChange}
            onRemove={() => onRefLastFrameChange?.(null)}
            shortcutLabel="使用下一分镜图"
            shortcutImage={nextShot?.storyboardImage ?? null}
            shortcutTooltip="下一分镜尚未生成分镜图"
            projectId={projectId}
          />
        </>
      )}
    </>
  );
}
