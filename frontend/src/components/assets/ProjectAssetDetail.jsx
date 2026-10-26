import ImageDetailModal from '../ImageDetailModal';

/**
 * 项目资产卡片的详情弹窗组合适配层。
 *
 * 主体详情通过显式组件 props 接入；分镜详情由项目资产面板统一编排。
 */
export default function ProjectAssetDetail({
  open = false,
  name,
  description,
  url,
  favorited = false,
  onToggleFavorite,
  asset = {},
  images = [],
  onClose,
  onDownload,
  onDelete,
  onShowToast,
  onCreateImage,
  onGenerateImage,
  SubjectAssetDetailModal,
}) {
  if (!open) return null;

  if (images.length > 0) {
    return (
      <SubjectAssetDetailModal
        onClose={onClose}
        name={name}
        description={description}
        images={images}
        favorited={favorited}
        onToggleFavorite={onToggleFavorite}
        onShowToast={onShowToast}
        onDownload={onDownload}
        onDeleteImage={(imageId) => {
          if (images.find((image) => image.id === imageId)?.localEdit) {
            onDelete?.(imageId);
            return;
          }
          if (images.length === 1) {
            onClose?.();
            onDelete?.();
          } else {
            onDelete?.(imageId);
          }
        }}
        onCreateImage={onCreateImage}
      />
    );
  }

  return (
    <ImageDetailModal visualMedia
      onGenerateImage={onGenerateImage}
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
      onDownload={onDownload}
      favorited={favorited}
      onToggleFavorite={onToggleFavorite}
      onDelete={() => {
        onClose?.();
        onDelete?.();
      }}
      onCreateImage={onCreateImage}
    />
  );
}
