import { StoryboardIconPlus } from './StoryboardActionPrimitives';

export default function StoryboardShotList({
  shotListRef,
  shots,
  dragId,
  overId,
  isLoadingMoreShots,
  onLoadMore,
  onDragEnd,
  onDragOverBeforeFirst,
  onDropBeforeFirst,
  onDragOverShot,
  onDropShot,
  onDragOverAfterLast,
  onDropAfterLast,
  onAddNewShot,
  renderShot,
}) {
  return (
    <div
      ref={shotListRef}
      style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}
      onScroll={(event) => {
        const { scrollTop, scrollHeight, clientHeight } = event.currentTarget;
        if (scrollHeight - scrollTop - clientHeight <= 120) onLoadMore();
      }}
      onDragEnd={onDragEnd}
    >
      {dragId && (
        <div
          style={{ height: '8px', flexShrink: 0, marginBottom: '-8px' }}
          onDragOver={onDragOverBeforeFirst}
          onDrop={onDropBeforeFirst}
        />
      )}
      {shots.map((shot, index) => renderShot(shot, index, {
        isDragging: dragId === shot.id,
        insertBefore: (overId === shot.id || (overId === '__before_first' && index === 0)) && dragId !== shot.id,
        insertAfter: overId === '__after_last' && index === shots.length - 1 && dragId !== shot.id,
        onDragOver: () => onDragOverShot(shot.id),
        onDrop: () => onDropShot(shot.id),
      }))}
      {isLoadingMoreShots && (
        <div style={{ flexShrink: 0, height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFFFFF99', fontSize: '12px' }}>
          正在加载更多分镜
        </div>
      )}
      {dragId && (
        <div
          style={{ height: '40px', flexShrink: 0 }}
          onDragOver={onDragOverAfterLast}
          onDrop={onDropAfterLast}
        />
      )}
      <div
        onClick={onAddNewShot}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '40px',
          minWidth: '1160px',
          marginBottom: '80px',
          borderRadius: '12px',
          border: '1px dashed rgba(255,255,255,0.12)',
          cursor: 'pointer',
          flexShrink: 0,
          gap: '6px',
          color: 'rgba(255,255,255,0.40)',
          fontSize: '14px',
          fontFamily: '"Alibaba PuHuiTi 2.0", system-ui, sans-serif',
          transition: 'border-color 150ms, color 150ms',
        }}
        onMouseEnter={(event) => {
          event.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)';
          event.currentTarget.style.color = 'rgba(255,255,255,0.70)';
        }}
        onMouseLeave={(event) => {
          event.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)';
          event.currentTarget.style.color = 'rgba(255,255,255,0.40)';
        }}
      >
        <StoryboardIconPlus color="currentColor" />
        添加空白分镜
      </div>
    </div>
  );
}
