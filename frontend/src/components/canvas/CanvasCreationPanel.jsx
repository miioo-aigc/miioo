import { useState } from 'react';
import { Plus } from 'lucide-react';
import { ComposerSurface } from '../ui';
import CreationSendButton from '../creation/CreationSendButton';

export default function CanvasCreationPanel({ nodeId, nodeType, prompt = '', references = [], onPromptChange, onAddReference, onGenerate }) {
  const [focused, setFocused] = useState(false);
  const placeholder = nodeType === 'audio' ? '输入文字，生成音频' : '描述你想要创作的内容';

  return <section className="canvas-creation-panel nodrag nowheel" aria-label="节点创作输入">
    <ComposerSurface width="100%" focused={focused} toolbar={<>
      <button type="button" className="canvas-node__subtle-button nodrag" onClick={() => onAddReference?.(nodeId)}>
        <Plus size={14} />
        <span>{references.length ? `参考素材 ${references.length}` : '添加参考'}</span>
      </button>
      <div className="canvas-creation-panel__actions">
        <span className="canvas-node__select">选择模型</span>
        <CreationSendButton onClick={() => onGenerate?.({ nodeId, prompt, references })} />
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
