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
          onDownload={() => onDownload(asset.id, asset.name)}
          onDelete={(imageId) => onDelete(asset.id, imageId)}
          onShowToast={onShowToast}
          asset={asset}
          category={activeCategory}
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
        assetType={activeCategory === 'storyboard_img' ? 'shot' : activeCategory === 'storyboard_video' ? 'shot_video' : 'asset'}
        onSelect={() => onSelect(asset.id)}
        onStar={() => onStar(asset.id)}
        onDownload={() => onDownload(asset.id, asset.name)}
        onDelete={() => onDelete(asset.id)}
        asset={asset}
      />
    );
  });
}
