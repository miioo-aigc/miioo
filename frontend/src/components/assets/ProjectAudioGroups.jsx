import CreationAudioResultCard from '../creation/CreationAudioResultCard';
import { groupProjectAudioAssets } from '../../utils/ProjectAudioGroupsAdapter';

/** 项目资产音频的分集/分镜时间线分区。 */
export default function ProjectAudioGroups({
  assets = [],
  batchMode = false,
  selected,
  onSelect,
  onStar,
  onDownload,
  onDelete,
  onOpenAudioDetail,
}) {
  return groupProjectAudioAssets(assets).map((group) => (
    <section key={group.key} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ fontFamily: "'AlibabaPuHuiTi_2_55_Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif", fontSize: '14px', color: '#FFFFFF99', flexShrink: 0 }}>
        {group.label}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '16px' }}>
        {group.assets.map((asset) => (
          <CreationAudioResultCard
            key={asset.id}
            id={asset.id}
            playbackKey={`project-asset-${asset.id}`}
            status="done"
            audioUrl={asset.audioUrl || asset.fileUrl || asset.url || null}
            audioId={asset.clipId || asset.clip_id || asset.id}
            prompt={asset.prompt || asset.input_prompt || asset.name || ''}
            advancedEnabled={Boolean(asset.advancedEnabled)}
            batchMode={batchMode}
            isSelected={batchMode && selected.has(asset.id)}
            onToggleSelect={() => onSelect(asset.id)}
            favorited={Boolean(asset.starred)}
            onToggleFavorite={() => onStar(asset.id)}
            onDownload={() => onDownload(asset.id, asset.name)}
            onDelete={() => onDelete(asset.id)}
            onCardClick={() => onOpenAudioDetail?.(asset)}
          />
        ))}
      </div>
    </section>
  ));
}

