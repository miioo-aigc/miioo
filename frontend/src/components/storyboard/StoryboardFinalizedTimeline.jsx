import StoryboardFinalizedCard from './StoryboardFinalizedCard';

export default function StoryboardFinalizedTimeline({ shots = [], finalizedMap = {}, selectedShotId = null, onSelectShot, onCreate, onPreview, onDownload }) {
  const items = shots.map((shot) => ({ shot, media: finalizedMap[shot.id] || null }));
  return (
    <div style={{ width: '100%', minWidth: 0, display: 'flex', gap: '10px', overflow: 'auto hidden', alignItems: 'center', justifyContent: 'flex-start' }}>
      {items.map(({ shot, media }) => <StoryboardFinalizedCard key={shot.id} shot={shot} media={media} selected={selectedShotId === shot.id} onSelect={() => onSelectShot?.(shot.id)} onCreate={() => onCreate?.(shot)} onPreview={onPreview} onDownload={onDownload} />)}
    </div>
  );
}
