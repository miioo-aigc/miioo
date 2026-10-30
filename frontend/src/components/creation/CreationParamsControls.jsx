/**
 * CreationPage 底部参数控制组合层。
 *
 * 这里负责把生成类型、模型、配音参数、图片参数和视频参数按生成类型组合起来。
 * 具体选择器仍通过 props 注入，避免把页面内既有视觉实现和状态迁移混在同一轮。
 * 页面继续持有参数状态、模型能力筛选和联动回调。
 * 2026-10-30 移除真人素材入口，认证统一由资产库承接。
 *   2026-10-30  模型菜单按实际行高限制为最多 7.5 项，超出后内部滚动
 */
export default function CreationParamsControls({
  genType,
  model,
  modelOptions,
  creationParams,
  disabled = false,
  onGenTypeChange,
  onModelChange,
  onBeforeModelOpen,
  dubbingSpeed,
  dubbingPitch,
  dubbingVolume,
  onDubbingSpeedChange,
  onDubbingPitchChange,
  onDubbingVolumeChange,
  dubbingAdvancedEnabled = false,
  onDubbingAdvancedChange,
  dubbingPromptCharacterCount = 0,
  dubbingHasTextSelection = false,
  onDubbingEmotionClick,
  onDubbingPauseClick,
  onDubbingInterjectionClick,
  dubbingEffects,
  onDubbingEffectToneChange,
  onDubbingEffectToggle,
  ratio,
  resolution,
  count,
  onRatioChange,
  onResolutionChange,
  onCountChange,
  refMode,
  referenceModeOptions,
  onRefModeChange,
  videoRatio,
  videoResolution,
  videoDuration,
  onVideoRatioChange,
  onVideoResolutionChange,
  onVideoDurationChange,
  soundEnabled,
  onSoundChange,
  GenTypeSelector,
  ModelSelector,
  DubbingAdjust,
  ParamsSelector,
  RefModeSelector,
  VideoParamsSelector,
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: 0, flexWrap: 'wrap', flex: 1, marginRight: '8px' }}>
      <GenTypeSelector value={genType} onChange={onGenTypeChange} disabled={disabled} />
      <ModelSelector
        value={model}
        onChange={onModelChange}
        options={modelOptions}
        menuMaxHeight={32 * 7.5}
        disabled={disabled}
        onBeforeOpen={onBeforeModelOpen}
      />

      {genType === 'dubbing' && (
        <DubbingAdjust
          speed={dubbingSpeed}
          pitch={dubbingPitch}
          volume={dubbingVolume}
          onSpeedChange={onDubbingSpeedChange}
          onPitchChange={onDubbingPitchChange}
          onVolumeChange={onDubbingVolumeChange}
          advancedEnabled={dubbingAdvancedEnabled}
          onAdvancedChange={onDubbingAdvancedChange}
          promptCharacterCount={dubbingPromptCharacterCount}
          hasTextSelection={dubbingHasTextSelection}
          onEmotionClick={onDubbingEmotionClick}
          onPauseClick={onDubbingPauseClick}
          onInterjectionClick={onDubbingInterjectionClick}
          effects={dubbingEffects}
          onEffectToneChange={onDubbingEffectToneChange}
          onEffectToggle={onDubbingEffectToggle}
          disabled={disabled}
        />
      )}

      {genType === 'image' && (
        <ParamsSelector
          ratio={ratio}
          resolution={resolution}
          count={count}
          onRatioChange={onRatioChange}
          onResolutionChange={onResolutionChange}
          onCountChange={onCountChange}
          disabled={disabled}
          ratioOptions={creationParams?.ratios ?? []}
          resolutionOptions={creationParams?.resolutions ?? []}
          countOptions={creationParams?.counts ?? []}
          resolutionRatios={creationParams?.resolutionRatios ?? {}}
        />
      )}

      {genType === 'video' && (
        <>
          <RefModeSelector
            value={refMode}
            onChange={onRefModeChange}
            disabled={disabled}
            options={referenceModeOptions ?? creationParams?.refModes ?? []}
          />
          <VideoParamsSelector
            ratio={videoRatio}
            resolution={videoResolution}
            duration={videoDuration}
            onRatioChange={onVideoRatioChange}
            onResolutionChange={onVideoResolutionChange}
            onDurationChange={onVideoDurationChange}
            disabled={disabled}
            ratioOptions={creationParams?.ratios ?? []}
            resolutionOptions={creationParams?.resolutions ?? []}
            durationOptions={creationParams?.durations ?? []}
            resolutionRatios={creationParams?.resolutionRatios ?? {}}
            soundEnabled={soundEnabled}
            onSoundChange={onSoundChange}
          />
        </>
      )}
    </div>
  );
}
