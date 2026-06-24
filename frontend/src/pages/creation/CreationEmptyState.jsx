import { memo } from 'react';
import CreationEmptyIconImage from './CreationEmptyIconImage';
import CreationEmptyIconVideo from './CreationEmptyIconVideo';
import CreationEmptyIconDubbing from './CreationEmptyIconDubbing';
import InputCard from '../../components/InputCard';
import EmptyIconShell from './EmptyIconShell';

const EMPTY_ICON_MAP = {
  image: CreationEmptyIconImage,
  video: CreationEmptyIconVideo,
  dubbing: CreationEmptyIconDubbing,
};

function CreationEmptyState({ onGenerate, genType, onGenTypeChange, model, onModelChange, modelOptions, creationParams, onBeforeModelOpen, showToast, activeCount = 0 }) {
  const EmptyIcon = EMPTY_ICON_MAP[genType] ?? CreationEmptyIconImage;
  return (
    <div style={{ display: 'flex', flex: 1, minHeight: 0, flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', alignSelf: 'stretch', gap: '0px', position: 'relative' }}>
      <div style={{ position: 'fixed', top: 'calc(50vh - 58px)', left: '50%', translate: '-50% -50%', display: 'flex', flexDirection: 'column', alignItems: 'center', pointerEvents: 'none', zIndex: 0, opacity: 0.5 }}>
        <EmptyIcon />
      </div>
      <div style={{ position: 'absolute', left: '50%', bottom: '16px', translate: '-50% 0', width: 'min(800px, 100%)' }}>
        <InputCard onGenerate={onGenerate} width="100%" genType={genType} onGenTypeChange={onGenTypeChange}
          model={model} onModelChange={onModelChange} modelOptions={modelOptions} creationParams={creationParams} onBeforeModelOpen={onBeforeModelOpen} showToast={showToast} activeCount={activeCount} />
      </div>
    </div>
  );
}

export default memo(CreationEmptyState);
