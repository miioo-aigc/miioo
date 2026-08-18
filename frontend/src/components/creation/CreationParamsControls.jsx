/**
 * CreationPage 底部参数控制组合层。
 *
 * 这里负责把生成类型、模型、配音参数、图片参数和视频参数按生成类型组合起来。
 * 具体选择器仍通过 props 注入，避免把页面内既有视觉实现和状态迁移混在同一轮。
 * 页面继续持有参数状态、模型能力筛选、联动回调和真人素材弹窗状态。
 */
export default function CreationParamsControls({
  genType,
  model,
  modelOptions,
  filteredModelOptions,
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
  ratio,
  resolution,
  count,
  onRatioChange,
  onResolutionChange,
  onCountChange,
  refMode,
  onRefModeChange,
  videoRatio,
  videoResolution,
  videoDuration,
  onVideoRatioChange,
  onVideoResolutionChange,
  onVideoDurationChange,
  soundEnabled,
  onSoundChange,
  showLiveMaterial = false,
  onOpenLiveMaterial,
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
        options={genType === 'video' ? filteredModelOptions : modelOptions}
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
            options={creationParams?.refModes ?? []}
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
          {showLiveMaterial && (
            <button
              type="button"
              disabled={disabled}
              onClick={() => !disabled && onOpenLiveMaterial?.()}
              style={{
                display: 'flex', alignItems: 'center', gap: '4px',
                height: '32px', paddingInline: '12px',
                borderRadius: '8px', flexShrink: 0,
                border: '1px solid #FFFFFF14',
                background: '#1D1E1E',
                outline: '1px solid #00000080',
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.45 : 1,
                transition: 'background 0.2s, border-color 0.2s',
              }}
              onMouseEnter={(event) => {
                if (!disabled) {
                  event.currentTarget.style.background = '#252525';
                  event.currentTarget.style.borderColor = '#FFFFFF29';
                }
              }}
              onMouseLeave={(event) => {
                if (!disabled) {
                  event.currentTarget.style.background = '#1D1E1E';
                  event.currentTarget.style.borderColor = '#FFFFFF14';
                }
              }}
              onMouseDown={(event) => {
                if (!disabled) event.currentTarget.style.background = '#161616';
              }}
              onMouseUp={(event) => {
                if (!disabled) event.currentTarget.style.background = '#252525';
              }}
            >
              <span style={{ fontFamily: "'AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif", fontSize: '12px', lineHeight: '16px', color: '#FFFFFFCC' }}>
                真人素材
              </span>
            </button>
          )}
        </>
      )}
    </div>
  );
}
