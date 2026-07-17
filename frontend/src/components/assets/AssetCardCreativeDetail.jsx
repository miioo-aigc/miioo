import ImageDetailModal from '../ImageDetailModal';
import CreationVideoDetailModal from '../CreationVideoDetailModal';

/**
 * 创作资产卡片的详情弹窗组合。
 * 只接收卡片数据和业务回调，不负责请求、下载命名、收藏状态存储或删除 API。
 */
export default function AssetCardCreativeDetail({ asset = {}, url, starred = false, onClose, onDownload, onDelete, onFavorite }) {
  if (asset.type === 'video') {
    return (
      <CreationVideoDetailModal
        videoUrl={asset.videoUrl}
        prompt={asset.prompt}
        model={asset.model}
        ratio={asset.ratio}
        resolution={asset.resolution}
        duration={asset.duration}
        refMode={asset.refMode}
        firstFrame={asset.firstFrame}
        lastFrame={asset.lastFrame}
        sound={asset.sound}
        createdAt={asset.createdAt}
        onDownload={onDownload}
        refImages={asset.refImages || []}
        onClose={onClose}
        onDelete={onDelete}
        favorited={starred}
        onFavorite={onFavorite}
      />
    );
  }

  if (asset.type === 'image') {
    return (
      <ImageDetailModal
        card={{
          imageUrl: asset.imageUrl || url,
          prompt: asset.input_prompt ?? asset.prompt,
          model: asset.model,
          ratio: asset.ratio,
          resolution: asset.resolution,
          refImages: asset.refImages,
          createdAt: asset.createdAt,
        }}
        onClose={onClose}
        onDownload={onDownload}
        onDelete={onDelete}
        favorited={starred}
        onToggleFavorite={onFavorite}
      />
    );
  }

  return null;
}
