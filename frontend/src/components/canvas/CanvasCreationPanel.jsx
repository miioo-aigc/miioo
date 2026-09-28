/**
 * @file CanvasCreationPanel.jsx
 * @structure-index
 * CanvasCreationPanel L18：公共创作皮肤、提示词、参考图栏与发送动作。
 * 2026-09-28：音频委托独立高级编辑组件，草稿由外壳持有。
 * 2026-09-28：视频支持三类参考素材，首尾帧发送仅携带前两槽图片。
 * 2026-09-28：媒体底栏替换占位，发送回调携带当前参数，未接入实际生成。
 * 2026-09-24：文本底部仅保留模型选择器与发送按钮，模型加载状态由外壳传入。
 */
import { useState } from 'react';
import CanvasMediaControls from './CanvasMediaControls';
import { ComposerSurface, Select } from '../ui';
import { getCanvasTextModelValue } from './CanvasTextModels';
import CreationSendButton from '../creation/CreationSendButton';
import CanvasReferenceBar from './CanvasReferenceBar';
import CanvasAudioCreationPanel from './CanvasAudioCreationPanel';

export default function CanvasCreationPanel({ nodeId, nodeType, prompt = '', references = [], model = '', modelState = { options: [], loading: false }, mediaControls, audioDraft, onAudioDraftChange, onModelChange, onPromptChange, onGenerate, onAddReference, onRemoveReference }) {
  const [focused, setFocused] = useState(false);
  if (nodeType === 'audio') return <CanvasAudioCreationPanel nodeId={nodeId} prompt={prompt} controls={mediaControls} draft={audioDraft} onDraftChange={onAudioDraftChange} onPromptChange={onPromptChange} onGenerate={onGenerate} />;
  const textNode = nodeType === 'text';
  const selectedModel = getCanvasTextModelValue(modelState.options, model);
  const placeholder = nodeType === 'audio' ? '输入文字，生成音频' : '描述你想要创作的内容';
  const c = mediaControls;
  const mediaParams = nodeType === 'image' ? { ratio: c?.ratio, resolution: c?.resolution, count: c?.count }
    : nodeType === 'video' ? { ratio: c?.videoRatio, resolution: c?.videoResolution, duration: c?.videoDuration, refMode: c?.refMode, soundEnabled: c?.soundEnabled }
      : { speed: c?.dubbingSpeed, pitch: c?.dubbingPitch, volume: c?.dubbingVolume };

  const hasReferences = nodeType === 'image' || nodeType === 'video';
  const referenceMode = nodeType === 'video' ? c?.refMode : 'all';
  const activeReferences = referenceMode === 'frame' ? references.filter((reference) => reference.slot < 2 && reference.asset.asset_type === 'image') : references;
  return <section className="canvas-creation-panel nodrag nowheel" data-references={hasReferences} aria-label="节点创作输入">
    <ComposerSurface width="100%" focused={focused} toolbar={<>
      {textNode ? <Select
        value={selectedModel}
        displayValue={modelState.options.find((option) => option.value === selectedModel)?.label || (modelState.error ? '模型加载失败' : '暂无可用文本模型')}
        options={modelState.options}
        loading={modelState.loading}
        width="200px"
        menuPlacement="up"
        menuAriaLabel="文本模型"
        onChange={onModelChange}
      /> : <CanvasMediaControls nodeType={nodeType} controls={mediaControls} />}
      <div className="canvas-creation-panel__actions">
        <CreationSendButton onClick={() => onGenerate?.({ nodeId, prompt, references: activeReferences, model: textNode ? selectedModel : c.model, ...(!textNode ? { params: mediaParams } : {}) })} />
      </div>
    </>}>
      {hasReferences && <CanvasReferenceBar nodeType={nodeType} references={references} mode={referenceMode} onAdd={onAddReference} onRemove={onRemoveReference} />}
      <textarea
        className="composer-surface__editor canvas-creation-panel__editor"
        aria-label="创作描述"
        value={prompt}
        onChange={(event) => onPromptChange?.(event.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        rows={2}
      />
    </ComposerSurface>
  </section>;
}
