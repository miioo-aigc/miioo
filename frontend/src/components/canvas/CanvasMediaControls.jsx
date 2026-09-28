/**
 * @file CanvasMediaControls.jsx
 * @structure-index
 * 2026-09-28：复用创作模型、图片参数、视频参考/参数和配音调整；保留视频音效，隐藏配音高级功能。
 */
import { ModelSelector } from '../creation/CreationModelSelector';
import { ParamsSelector } from '../creation/CreationImageParamsSelector';
import { RefModeSelector } from '../creation/CreationRefModeSelector';
import { VideoParamsSelector } from '../creation/CreationVideoParamsSelector';
import { DubbingAdjust } from '../creation/CreationDubbingAdjust';

export default function CanvasMediaControls({ nodeType, controls: c }) {
  const disabled = c.loading || !c.model;
  const options = {
    ratioOptions: c.creationParams?.ratios ?? [],
    resolutionOptions: c.creationParams?.resolutions ?? [],
    resolutionRatios: c.creationParams?.resolutionRatios ?? {},
    disabled,
  };
  return <div className="canvas-creation-panel__media-controls">
    <ModelSelector value={c.model || (c.loading ? '加载中' : c.error ? '模型加载失败' : '暂无可用模型')} options={c.options} onChange={c.onModelChange} disabled={disabled} />
    {nodeType === 'image' && <ParamsSelector {...options}
      ratio={c.ratio} resolution={c.resolution} count={c.count}
      countOptions={c.creationParams?.counts ?? []}
      onRatioChange={c.setRatio} onResolutionChange={c.setResolution} onCountChange={c.setCount} />}
    {nodeType === 'video' && <>
      <RefModeSelector value={c.refMode} options={c.creationParams?.refModes ?? []} onChange={c.setRefMode} disabled={disabled} />
      <VideoParamsSelector {...options}
        ratio={c.videoRatio} resolution={c.videoResolution} duration={c.videoDuration}
        durationOptions={c.creationParams?.durations ?? []}
        onRatioChange={c.setVideoRatio} onResolutionChange={c.setVideoResolution} onDurationChange={c.setVideoDuration}
        soundEnabled={c.soundEnabled} onSoundChange={c.setSoundEnabled} />
    </>}
    {nodeType === 'audio' && <DubbingAdjust
      speed={c.dubbingSpeed} pitch={c.dubbingPitch} volume={c.dubbingVolume}
      onSpeedChange={c.setDubbingSpeed} onPitchChange={c.setDubbingPitch} onVolumeChange={c.setDubbingVolume}
      showAdvanced={false} disabled={disabled} />}
  </div>;
}
