import ImageDetailModal from '../ImageDetailModal';

/**
 * 项目资产卡片的详情弹窗组合适配层。
 *
 * 分镜和主体详情弹窗目前仍定义在 AssetsPage 中，因此通过显式组件 props
 * 接入，避免资产组件反向引用页面；页面继续负责 API、状态和业务回调。
 */
export default function ProjectAssetDetail({
  open = false,
  category = '',
  name,
  description,
  url,
  asset = {},
  images = [],
  onClose,
  onDownload,
  onDelete,
  onShowToast,
  SubjectAssetDetailModal,
  ShotDetailModal,
  ShotVideoDetailModal,
}) {
  if (!open) return null;

  const mappedImages = images.map((image) => ({
    ...image,
    src: image.fileUrl ?? image.url,
    finalized: image.is_primary,
  }));

  if (category === 'storyboard_img') {
    return (
      <ShotDetailModal
        onClose={onClose}
        onDownload={() => onDownload?.()}
        onDelete={() => onDelete?.()}
        onShowToast={onShowToast}
        shotNumber={name}
        prompt={asset.input_prompt ?? asset.prompt}
        model={asset.model}
        resolution={asset.resolution}
        generatedAt={asset.created_at}
        images={mappedImages}
        refImages={asset.refImages}
      />
    );
  }

  if (category === 'storyboard_video') {
    return (
      <ShotVideoDetailModal
        onClose={onClose}
        onDownload={() => onDownload?.()}
        onDelete={() => onDelete?.()}
        onShowToast={onShowToast}
        shotNumber={name}
        prompt={asset.input_prompt ?? asset.prompt}
        model={asset.model}
        resolution={asset.resolution}
        ratio={asset.ratio}
        generatedAt={asset.created_at}
        videoSrc={asset.videoUrl}
        frames={mappedImages}
        refMode={asset.refMode}
        firstFrame={asset.firstFrame}
        lastFrame={asset.lastFrame}
        refImages={asset.refImages}
        refVideos={asset.refVideos}
      />
    );
  }

  if (images.length > 0) {
    return (
      <SubjectAssetDetailModal
        onClose={onClose}
        name={name}
        description={description}
        images={images}
        onShowToast={onShowToast}
        onDownload={onDownload}
        onDeleteImage={(imageId) => {
          if (images.length === 1) {
            onClose?.();
            onDelete?.();
          } else {
            onDelete?.(imageId);
          }
        }}
      />
    );
  }

  return (
    <ImageDetailModal
      card={{
        imageUrl: asset.fileUrl || asset.url || url,
        prompt: asset.input_prompt ?? asset.prompt,
        model: asset.model,
        ratio: asset.ratio,
        resolution: asset.resolution,
        refImages: asset.refImages,
        createdAt: asset.created_at,
      }}
      onClose={onClose}
      onDelete={() => {
        onClose?.();
        onDelete?.();
      }}
    />
  );
}
