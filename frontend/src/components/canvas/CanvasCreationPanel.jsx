/**
 * @file CanvasCreationPanel.jsx
 * @structure-index
 * CanvasCreationPanel L19：公共创作皮肤、提示词、参考图栏与发送动作。
 * 2026-09-28：中文组词保留本地草稿，确认后同步；隔离画布键盘事件。
 * 2026-09-28：音频委托独立高级编辑组件，草稿由外壳持有。
 * 2026-09-28：视频支持三类参考素材，首尾帧发送仅携带前两槽图片。
 * 2026-09-28：媒体底栏替换占位，发送回调携带当前参数，未接入实际生成。
 * 2026-09-28：输入框点击不冒泡触发节点延迟选中；仅结果生成中阻止重复写入。
 */
import { useRef, useState } from 'react';
import CanvasMediaControls from './CanvasMediaControls';
import { ComposerSurface, Select } from '../ui';
import { getCanvasTextModelValue } from './CanvasTextModels';
import CreationSendButton from '../creation/CreationSendButton';
import CanvasReferenceBar from './CanvasReferenceBar';
import CanvasAudioCreationPanel from './CanvasAudioCreationPanel';

export default function CanvasCreationPanel({ nodeId, nodeType, prompt = '', references = [], model = '', modelState = { options: [], loading: false }, generating = false, generationError = '', mediaControls, audioDraft, onAudioDraftChange, onModelChange, onPromptChange, onGenerate, onAddReference, onRemoveReference }) {
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState(prompt);
  const [lastPrompt, setLastPrompt] = useState(prompt);
  const [composing, setComposing] = useState(false);
  const composingRef = useRef(false);
  // 外部导入仍同步到编辑器，输入法组词期间不覆盖本地文字。
  if (lastPrompt !== prompt && !composing) {
    setLastPrompt(prompt);
    setDraft(prompt);
  }
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
  return <section className="canvas-creation-panel nodrag nowheel" data-references={hasReferences} aria-label="节点创作输入" onClick={(event) => event.stopPropagation()} onDoubleClick={(event) => event.stopPropagation()}>
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
        <CreationSendButton onClick={() => { if (!generating && !composingRef.current) onGenerate?.({ nodeId, prompt: draft, references: activeReferences, model: textNode ? selectedModel : c.model, ...(!textNode ? { params: mediaParams } : {}) }); }} />
      </div>
    </>}>
      {hasReferences && <CanvasReferenceBar nodeType={nodeType} references={references} mode={referenceMode} onAdd={onAddReference} onRemove={onRemoveReference} />}
      <textarea
        className="composer-surface__editor canvas-creation-panel__editor"
        aria-label="创作描述"
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value);
          if (!composingRef.current) onPromptChange?.(event.target.value);
        }}
        onCompositionStart={() => { composingRef.current = true; setComposing(true); }}
        onCompositionEnd={(event) => {
          composingRef.current = false;
          setComposing(false);
          setDraft(event.currentTarget.value);
          onPromptChange?.(event.currentTarget.value);
        }}
        onKeyDown={(event) => event.stopPropagation()}
        onKeyUp={(event) => event.stopPropagation()}
        onFocus={() => setFocused(true)}
        onBlur={(event) => {
          setFocused(false);
          composingRef.current = false;
          setComposing(false);
          onPromptChange?.(event.currentTarget.value);
        }}
        placeholder={placeholder}
        rows={2}
      />
    </ComposerSurface>
    {generationError && <p role="alert" className="text-[12px] text-text-danger">{generationError}</p>}
  </section>;
}
