import ShotRow from '../../../components/ShotRow';
import { IconPlus } from '../../../components/StoryboardIcons';

export default function ShotList({
  shots,
  projectId,
  chars,
  dragId,
  overId,
  setDragId,
  setOverId,
  handleDrop,
  updateShot,
  addShotAfter,
  copyShot,
  deleteShot,
  imagePanel,
  setImagePanel,
  videoPanel,
  setVideoPanel,
  genImageHistoryMap,
  setGenImageHistoryMap,
  genVideoHistoryMap,
  setGenVideoHistoryMap,
  globalVoiceParams,
  setGlobalVoiceParams,
  generatingImageShotIds,
  generatingVideoShotIds,
  downloadMode,
  selectedShotIds,
  toggleShotSelection,
  addNewShot,
}) {
  return (
    <div
      style={{ flex: 1, overflowY: 'auto', overflowX: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}
      onDragEnd={() => { setDragId(null); setOverId(null); }}
    >
      {/* top sentinel — drop zone for placing before the first card */}
      {dragId && (
        <div
          style={{ height: '8px', flexShrink: 0, marginBottom: '-8px' }}
          onDragOver={(e) => { e.preventDefault(); setOverId('__before_first'); }}
          onDrop={(e) => { e.preventDefault(); handleDrop('__before_first'); }}
        />
      )}
      {shots.map((shot, idx) => (
        <ShotRow
          key={shot.id}
          shot={shot}
          projectId={projectId}
          onChange={(next) => updateShot(shot.id, next)}
          onAdd={() => addShotAfter(shot.id)}
          onCopy={() => copyShot(shot.id)}
          onDelete={() => deleteShot(shot.id)}
          chars={chars}
          isDragging={dragId === shot.id}
          insertBefore={(overId === shot.id || (overId === '__before_first' && idx === 0)) && dragId !== shot.id}
          insertAfter={overId === '__after_last' && idx === shots.length - 1 && dragId !== shot.id}
          onDragStart={() => setDragId(shot.id)}
          onDragOver={() => { if (dragId && dragId !== shot.id) setOverId(shot.id); }}
          onDrop={() => handleDrop(shot.id)}
          onGenerateImage={() => {
            setGenImageHistoryMap((prev) => {
              const shotId = shot.id;
              if (!prev[shotId] || prev[shotId].length === 0) {
                const initialized = { ...prev };
                if (shot.storyboardImage?.url) {
                  initialized[shotId] = [{ url: shot.storyboardImage.url, settled: true, id: shot.storyboardImage.id }];
                } else {
                  initialized[shotId] = [];
                }
                return initialized;
              }
              return prev;
            });
            setImagePanel({ shot });
          }}
          onGenerateVideo={() => {
            setGenVideoHistoryMap((prev) => {
              const shotId = shot.id;
              if (!prev[shotId] || prev[shotId].length === 0) {
                const initialized = { ...prev };
                if (shot.storyboardVideo?.url) {
                  initialized[shotId] = [{ url: shot.storyboardVideo.url, settled: true, id: shot.storyboardVideo.id }];
                } else {
                  initialized[shotId] = [];
                }
                return initialized;
              }
              return prev;
            });
            setVideoPanel({ shot, nextShot: shots[idx + 1] ?? null });
          }}
          globalVoiceParams={globalVoiceParams}
          onSaveGlobalVoice={(role, params) => setGlobalVoiceParams((prev) => ({ ...prev, [role]: params }))}
          generatingImage={generatingImageShotIds.has(shot.id)}
          generatingVideo={generatingVideoShotIds.has(shot.id)}
          isSelectMode={downloadMode}
          isSelected={selectedShotIds.has(shot.id)}
          onToggleSelect={() => toggleShotSelection(shot.id)}
        />
      ))}
      {/* bottom sentinel — drop zone for placing after the last card */}
      {dragId && (
        <div
          style={{ height: '40px', flexShrink: 0 }}
          onDragOver={(e) => { e.preventDefault(); setOverId('__after_last'); }}
          onDrop={(e) => { e.preventDefault(); handleDrop('__after_last'); }}
        />
      )}

      {/* 新增行按钮 */}
      <div
        onClick={addNewShot}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '40px',
          minWidth: '1160px',
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
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)';
          e.currentTarget.style.color = 'rgba(255,255,255,0.70)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)';
          e.currentTarget.style.color = 'rgba(255,255,255,0.40)';
        }}
      >
        <IconPlus color="currentColor" />
        添加空白分镜
      </div>
    </div>
  );
}
