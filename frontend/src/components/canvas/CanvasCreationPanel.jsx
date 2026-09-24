/**
 * @file CanvasCreationPanel.jsx
 * @structure-index
 * 公共创作皮肤、提示词和发送动作；文本类型复用 Select，其余类型保留参考入口。
 * 2026-09-24：文本底部仅保留模型选择器与发送按钮，模型加载状态由外壳传入。
 */
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { ComposerSurface, Select } from '../ui';
import { getCanvasTextModelValue } from './CanvasTextModels';
import CreationSendButton from '../creation/CreationSendButton';

export default function CanvasCreationPanel({ nodeId, nodeType, prompt = '', references = [], model = '', modelState = { options: [], loading: false }, onModelChange, onPromptChange, onAddReference, onGenerate }) {
  const [focused, setFocused] = useState(false);
  const textNode = nodeType === 'text';
  const selectedModel = getCanvasTextModelValue(modelState.options, model);
  const placeholder = nodeType === 'audio' ? '输入文字，生成音频' : '描述你想要创作的内容';

  return <section className="canvas-creation-panel nodrag nowheel" aria-label="节点创作输入">
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
      /> : <button type="button" className="canvas-node__subtle-button nodrag" onClick={() => onAddReference?.(nodeId)}>
        <Plus size={14} />
        <span>{references.length ? `参考素材 ${references.length}` : '添加参考'}</span>
      </button>}
      <div className="canvas-creation-panel__actions">
        {!textNode && <span className="canvas-node__select">选择模型</span>}
        <CreationSendButton onClick={() => onGenerate?.({ nodeId, prompt, references, ...(textNode ? { model: selectedModel } : {}) })} />
      </div>
    </>}>
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
