import StoryboardShotRow from './StoryboardShotRow';
import ShotNumberColumn from './ShotNumberColumn';
import DescriptionCol from './DescriptionCol';
import { NarrationColWrapper } from './NarrationCol';
import MainRefColWrapper from './MainRefCol';
import TextEditCol from './TextEditCol';
import StoryboardShotMediaColumn from './StoryboardShotMediaColumn';

export default function StoryboardShotRowContent({
  shot,
  onChange,
  onAdd,
  onCopy,
  onDelete,
  chars,
  isDragging,
  onDragStart,
  onDragOver,
  onDrop,
  insertBefore,
  insertAfter,
  globalVoiceParams,
  onSaveGlobalVoice,
  projectId,
  generatingImage,
  generatingVideo,
  candidates = [],
  mediaLoading = false,
  onOpenCreation,
  onFinalizeToggle,
  onSelectShot,
  isSelectMode = false,
  isSelected = false,
  isActive = false,
  onSelect,
  onToggleSelect,
  onUploadImage,
  onUploadVideo,
  onUploadMainRef,
  onConfirmMainRefAssets,
  durationOptions = [],
}) {
  return (
    <StoryboardShotRow
      shot={shot}
      onDelete={onDelete}
      isDragging={isDragging}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      insertBefore={insertBefore}
      insertAfter={insertAfter}
      isSelectMode={isSelectMode}
      isSelected={isSelected}
      isActive={isActive}
      onSelect={onSelect}
    >
      <ShotNumberColumn
        number={shot.number}
        onAdd={onAdd}
        onCopy={onCopy}
        isSelectMode={isSelectMode}
        isSelected={isSelected}
        onToggleSelect={onToggleSelect}
      />
      <DescriptionCol shot={shot} onChange={onChange} durationOptions={durationOptions} />
      <TextEditCol label="光影" value={shot.lightShadow} onChange={(value) => onChange({ ...shot, lightShadow: value })} />
      <TextEditCol label="环境音" value={shot.ambientSound} onChange={(value) => onChange({ ...shot, ambientSound: value })} />
      <NarrationColWrapper
        shot={shot}
        onChange={onChange}
        chars={chars}
        globalVoiceParams={globalVoiceParams}
        onSaveGlobalVoice={onSaveGlobalVoice}
      />
      <MainRefColWrapper
        shot={shot}
        onChange={onChange}
        projectId={projectId}
        onUploadFile={onUploadMainRef}
        onAssetConfirm={onConfirmMainRefAssets}
      />
      <StoryboardShotMediaColumn
        image={shot.storyboardImage}
        video={shot.storyboardVideo}
        candidates={candidates}
        loading={mediaLoading}
        generating={generatingImage || generatingVideo}
        onOpenCreation={onOpenCreation}
        onFinalizeToggle={onFinalizeToggle}
        onSelectShot={onSelectShot}
        onUpload={(file) => {
          const media = { id: URL.createObjectURL(file), url: URL.createObjectURL(file), name: file.name, type: file.type, file };
          if (file.type.startsWith('video/')) onUploadVideo?.(shot, media);
          else onUploadImage?.(shot, media);
        }}
        shotLabel={`镜头 ${String(shot.number).padStart(2, '0')}`}
      />
    </StoryboardShotRow>
  );
}
