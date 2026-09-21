/**
 * 创作输入区的视觉组合层。
 *
 * 该组件只负责业务子组件接线；公共布局和悬浮反馈由 ComposerSurface 提供；素材状态、参数状态、
 * 生成参数组装、生成请求和失败恢复仍由 InputCard 持有并通过显式配置传入。
 */

import { ComposerSurface } from '../ui';
import CreationPromptEditor from './CreationPromptEditor';
import CreationUploadArea, { UploadPlaceholder } from './CreationUploadArea';
import CreationParamsControls from './CreationParamsControls';
import CreationSendButton from './CreationSendButton';
import CreationInputOverlays from './CreationInputOverlays';
import { DubbingVoiceFileCard } from './CreationDubbingVoiceModal';
import { GenTypeSelector } from './CreationGenTypeSelector';
import { ModelSelector } from './CreationModelSelector';
import { ParamsSelector } from './CreationImageParamsSelector';
import { RefModeSelector } from './CreationRefModeSelector';
import { VideoParamsSelector } from './CreationVideoParamsSelector';
import { DubbingAdjust } from './CreationDubbingAdjust';

function CreationInputSurface({ width = '800px', disabled = false, promptDisabled = disabled, focused = false, upload, prompt, controls, send, overlays }) {
  const usesAdvancedDubbingLayout = upload.genType === 'dubbing' && prompt.dubbingAdvancedEnabled;

  return (
    <>
      <ComposerSurface
        width={width}
        focused={focused}
        disabled={disabled}
        dimmed={disabled && !usesAdvancedDubbingLayout}
        stretch
        toolbar={(
          <>
            <CreationParamsControls
              {...controls}
              disabled={disabled}
              GenTypeSelector={GenTypeSelector}
              ModelSelector={ModelSelector}
              DubbingAdjust={DubbingAdjust}
              ParamsSelector={ParamsSelector}
              RefModeSelector={RefModeSelector}
              VideoParamsSelector={VideoParamsSelector}
            />
            <CreationSendButton {...send} />
          </>
        )}
      >
            {!usesAdvancedDubbingLayout && (
              <CreationUploadArea
                genType={upload.genType}
                refMode={upload.refMode}
                firstFrameFile={upload.firstFrameFile}
                lastFrameFile={upload.lastFrameFile}
                onFirstChange={upload.onFirstChange}
                onLastChange={upload.onLastChange}
                onSwap={upload.onSwap}
                onFirstAssetPick={upload.onFirstAssetPick}
                onLastAssetPick={upload.onLastAssetPick}
                uploadProps={{
                  onFileSelect: upload.onFileSelect,
                  onAssetPick: upload.onAssetPick,
                  allowedExts: upload.allowedExts,
                  acceptAttr: upload.acceptAttr,
                }}
                renderVoiceControl={() => upload.voiceId ? (
                  <DubbingVoiceFileCard
                    voiceName={upload.voiceName}
                    onRemove={upload.onVoiceRemove}
                    onOpenModal={upload.onOpenVoiceModal}
                  />
                ) : (
                  <UploadPlaceholder
                    onDirectClick={upload.onOpenVoiceModal}
                    tooltip="选择音色"
                    allowedExts={upload.allowedExts}
                    acceptAttr={upload.acceptAttr}
                    disabled={disabled}
                  />
                )}
                disabled={disabled}
              />
            )}
            <CreationPromptEditor
              {...prompt}
              disabled={promptDisabled}
              voiceControl={usesAdvancedDubbingLayout ? {
                voiceId: upload.voiceId,
                voiceName: upload.voiceName,
                onRemove: upload.onVoiceRemove,
                onOpen: upload.onOpenVoiceModal,
                allowedExts: upload.allowedExts,
                acceptAttr: upload.acceptAttr,
              } : null}
            />
      </ComposerSurface>
      <CreationInputOverlays {...overlays} />
    </>
  );
}

export default CreationInputSurface;
