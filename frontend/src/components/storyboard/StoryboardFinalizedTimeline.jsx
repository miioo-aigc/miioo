import StoryboardFinalizedCard from './StoryboardFinalizedCard';

function getStoryboardTimelineCardSize(projectRatio) {
  return String(projectRatio || '').replace(/\s/g, '') === '9:16'
    ? { width: 135, height: 240 }
    : { width: 240, height: 135 };
}

export default function StoryboardFinalizedTimeline({ projectRatio = '16:9', shots = [], finalizedMap = {}, selectedShotId = null, onSelectShot, onCreate, onPreview, onDownload }) {
  const items = shots.map((shot) => ({ shot, media: finalizedMap[shot.id] || null }));
  const cardSize = getStoryboardTimelineCardSize(projectRatio);
  return (
    <div style={{ width: '100%', minWidth: 0, display: 'flex', gap: '10px', overflow: 'auto hidden', alignItems: 'center', justifyContent: 'flex-start' }}>
      {items.map(({ shot, media }, index) => <StoryboardFinalizedCard key={shot.id || `timeline-shot-${shot.number || index + 1}-${index}`} shot={shot} media={media} cardSize={cardSize} selected={selectedShotId === shot.id} onSelect={() => onSelectShot?.(shot.id)} onCreate={() => onCreate?.(shot)} onPreview={onPreview} onDownload={onDownload} />)}
    </div>
  );
}
