import AssetsAudioCard from './AssetsAudioCard';
import { AssetCard, ProjectAssetCard } from './AssetsCards';

/**
 * 项目资产卡片网格。
 * 只负责按资产类别选择卡片变体，并把操作通过显式回调交给项目资产面板。
 */
export default function AssetsProjectGrid({
  assets = [],
  activeCategory,
  subjectCardCategories,
  batchMode,
  selected,
  onSelect,
  onStar,
  onDownload,
  onDelete,
  onShowToast,
  onOpenAudioDetail,
  onOpenStoryboardDetail,
}) {
  return assets.map((asset) => {
    const isSelected = batchMode && selected.has(asset.id);

    if (activeCategory === 'audio') {
      return (
        <AssetsAudioCard
          key={asset.id}
          name={asset.name}
          duration={asset.duration}
          starred={asset.starred}
          selected={isSelected}
          batchMode={batchMode}
          onSelect={() => onSelect(asset.id)}
          onStar={() => onStar(asset.id)}
          onDownload={() => onDownload(asset.id, asset.name)}
          onDelete={() => onDelete(asset.id)}
          onOpen={() => onOpenAudioDetail?.(asset)}
        />
      );
    }

    if (subjectCardCategories.has(activeCategory)) {
      return (
        <ProjectAssetCard
          key={asset.id}
          name={asset.name}
          desc={asset.description}
          url={asset.url || null}
          selected={isSelected}
          batchMode={batchMode}
          onSelect={() => onSelect(asset.id)}
          onDownload={(downloadId = asset.id, downloadName = asset.name, downloadAssetRecord = asset) => (
            onDownload(downloadId, downloadName, downloadAssetRecord)
          )}
          onDelete={(imageId) => onDelete(asset.id, imageId)}
          onShowToast={onShowToast}
          asset={asset}
          category={activeCategory}
          onOpenDetail={activeCategory === 'storyboard' ? () => onOpenStoryboardDetail?.(asset) : undefined}
        />
      );
    }

    return (
      <AssetCard
        key={asset.id}
        name={asset.name}
        url={asset.url || null}
        starred={asset.starred}
        selected={isSelected}
        batchMode={batchMode}
        assetType={activeCategory === 'storyboard' ? 'shot' : 'asset'}
        videoObjectFit={activeCategory === 'final' ? 'contain' : 'cover'}
        onSelect={() => onSelect(asset.id)}
        onStar={() => onStar(asset.id)}
        onDownload={() => onDownload(asset.id, asset.name)}
        onDelete={() => onDelete(asset.id)}
        asset={asset}
      />
    );
  });
}
