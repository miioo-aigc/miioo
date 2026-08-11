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
 *   2026-08-11  恢复首尾帧模式的尾帧上传入口
 *   2026-07-16  上传槽位改为业务域内直接引入，移除页面级组件转发边界；保留素材状态与回调契约
 *   2026-08-10  首帧新增“使用上一个分镜视频尾帧”快捷入口，抽帧和上传由面板业务回调负责
 *   2026-08-10  首帧新增当前分镜图片选择弹窗，图片候选由视频面板显式注入
 */

import { useCallback, useState } from 'react';
import { normalizeImageUrl } from '../../utils/imageUrl';
import { FrameUploadSlot, PanelUploadSlot } from './StoryboardUploadSlots';
import CurrentShotImagePickerPopover from './CurrentShotImagePickerPopover';

export default function ReferenceMediaEditor({
  tab,
  projectId,
  shot,
  nextShot,
  previousFrameShortcut = null,
  currentShotImages = [],
  showRefSubjects,
  showRefImages,
  showRefVideo,
  showRefAudio,
  maxRefImages,
  maxRefVideos,
  maxRefAudios,
  imageCountLabel,
  videoCountLabel,
  audioCountLabel,
  canAddImage,
  refSubjects = [],
  refImages = [],
  refVideos = [],
  refAudios = [],
  refFirstFrame = null,
  refLastFrame = null,
  onRefSubjectsChange,
  onRefImagesChange,
  onRefVideosChange,
  onRefAudiosChange,
  onRefFirstFrameChange,
  onRefLastFrameChange,
  onUsePreviousFrameShortcut,
  onReferenceMediaUpload,
  buildRefFromAsset,
  onInsertReference,
}) {
  const [currentShotImagePickerOpen, setCurrentShotImagePickerOpen] = useState(false);
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
    uploadBlobMedia(media, 'video', (uploaded) => {
      onRefVideosChange?.((prev) => [...prev, uploaded]);
    });
  }, [onRefVideosChange, uploadBlobMedia]);

  const appendAudio = useCallback((media) => {
    uploadBlobMedia(media, 'audio', (uploaded) => {
      onRefAudiosChange?.((prev) => [...prev, uploaded]);
    });
  }, [onRefAudiosChange, uploadBlobMedia]);

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
              mediaList={refVideos}
              canAddMore={maxRefVideos == null || refVideos.length < maxRefVideos}
              onUpload={appendVideo}
              onRemove={() => onRefVideosChange?.([])}
              onRemoveItem={(index) => onRefVideosChange?.((prev) => prev.filter((_, itemIndex) => itemIndex !== index))}
              onAssetConfirm={(assets) => {
                const items = (assets || []).map((asset) => ({ id: asset.id, url: asset.fileUrl || asset.url, name: asset.name || '参考视频', type: 'video/mp4' }));
                onRefVideosChange?.((prev) => [...prev, ...items].slice(0, maxRefVideos ?? 99));
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
              mediaList={refAudios}
              canAddMore={maxRefAudios == null || refAudios.length < maxRefAudios}
              onUpload={appendAudio}
              onRemove={() => onRefAudiosChange?.([])}
              onRemoveItem={(index) => onRefAudiosChange?.((prev) => prev.filter((_, itemIndex) => itemIndex !== index))}
              onAssetConfirm={(assets) => {
                const items = (assets || []).map((asset) => ({ id: asset.id, url: asset.fileUrl || asset.url, name: asset.name || '参考音频', type: 'audio/mpeg' }));
                onRefAudiosChange?.((prev) => [...prev, ...items].slice(0, maxRefAudios ?? 99));
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
            shortcutItems={[
              {
                image: shot?.storyboardImage ?? null,
                label: '从当前分镜中选取',
                tooltip: currentShotImages.length ? '从当前分镜图片中选择' : '当前分镜暂无图片',
                enabled: true,
                onSelect: () => setCurrentShotImagePickerOpen(true),
              },
              {
                image: previousFrameShortcut?.media,
                label: previousFrameShortcut?.label || '使用上一个分镜\n视频尾帧',
                tooltip: previousFrameShortcut?.tooltip || '上一个分镜尚未生成视频',
                onSelect: onUsePreviousFrameShortcut,
              },
            ]}
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
      <CurrentShotImagePickerPopover
        open={currentShotImagePickerOpen}
        images={currentShotImages}
        onClose={() => setCurrentShotImagePickerOpen(false)}
        onSelect={(image) => {
          onRefFirstFrameChange?.({ ...image, type: image.type || 'image/jpeg', media_type: 'image' });
          setCurrentShotImagePickerOpen(false);
        }}
      />
    </>
  );
}
