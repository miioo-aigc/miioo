/**
 * 创作输入区的视觉组合层。
 *
 * 该组件只负责输入卡片的布局、悬浮反馈和子组件接线；素材状态、参数状态、
 * 生成参数组装、生成请求和失败恢复仍由 InputCard 持有并通过显式配置传入。
 */

import { useEffect, useState } from 'react';
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

const ROTATE_STYLE_ID = 'creation-chatbox-rotate-style';

function ensureRotateKeyframe() {
  if (document.getElementById(ROTATE_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = ROTATE_STYLE_ID;
  style.textContent = `
    @property --creation-chatbox-angle {
      syntax: '<angle>';
      initial-value: 161.1deg;
      inherits: false;
    }
    @keyframes creation-chatbox-spin {
      from { --creation-chatbox-angle: 161.1deg; }
      to { --creation-chatbox-angle: 521.1deg; }
    }
  `;
  document.head.appendChild(style);
}

function CreationInputSurface({ width = '800px', disabled = false, promptDisabled = disabled, focused = false, upload, prompt, controls, send, overlays }) {
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    ensureRotateKeyframe();
  }, []);

  const hoverBg = 'conic-gradient(from var(--creation-chatbox-angle), oklab(86.8% -0.081 -0.057 / 30%) 0%, oklab(75.5% -0.102 -0.072 / 25%) 15%, oklab(75.5% -0.102 -0.072 / 0%) 50%, oklab(100% 0 0 / 5%) 55%, oklab(86.8% -0.081 -0.057 / 30%) 100%)';
  const idleBg = 'linear-gradient(in oklab 161.1deg, oklab(86.8% -0.081 -0.057 / 30%) 9.06%, oklab(75.5% -0.102 -0.072 / 25%) 15.35%, oklab(75.5% -0.102 -0.072 / 0%) 52.98%, oklab(100% 0 0 / 5%) 56.39%)';
  const isTyping = focused;
  const wrapperStyle = isTyping
    ? { background: '#2DC3E1', animation: 'none' }
    : hovered
      ? { backgroundImage: hoverBg, animation: 'creation-chatbox-spin 4s linear infinite' }
      : { backgroundImage: idleBg, animation: 'none' };

  return (
    <>
      <div
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0px',
          borderRadius: '20px', justifyContent: 'flex-end', padding: '1px', width,
          ...wrapperStyle, boxShadow: '-5px -10px 50px #2DC3E11F', opacity: disabled ? 0.72 : 1,
          overflow: 'visible',
        }}
        onMouseEnter={() => !disabled && setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0px',
            borderRadius: '19px', paddingTop: '16px', paddingBottom: '12px', flex: 1,
            alignSelf: 'stretch', background: '#131313', paddingLeft: '16px', paddingRight: '16px',
            overflow: 'visible',
          }}
        >
          <div
            style={{
              display: 'flex', alignItems: 'flex-start', gap: '16px', alignSelf: 'stretch',
              height: '110px', flexShrink: 0, padding: 0, position: 'relative', overflow: 'visible',
            }}
          >
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
            <CreationPromptEditor
              {...prompt}
              disabled={promptDisabled}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0px', justifyContent: 'space-between', alignSelf: 'stretch' }}>
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
          </div>
        </div>
      </div>
      <CreationInputOverlays {...overlays} />
    </>
  );
}

export default CreationInputSurface;
