/**
 * @file InputCard.jsx
 * @structure-index
 *
 * ─── 状态层 ─────────────────────────────────────────────────────────
 *   输入文本、文件列表、模型列表、焦点/悬停态和缓存导航游标
 *
 * ─── 数据流 ─────────────────────────────────────────────────────────
 *   模型 API、草稿缓存、文件校验；通过 onSend/onStop 和选择回调通知页面
 *
 * ─── 组件结构 ───────────────────────────────────────────────────────
 *   UploadPlaceholder / FileCard / ModelSelector / EpisodeCountSelector / SendButton
 *
 * ─── 更新记录 ───────────────────────────────────────────────────────
 *   2026-07-15  从 ScriptPage 抽离会话输入区，保持输入、缓存导航和发送行为不变
 *   2026-07-16  补齐模型加载和草稿缓存导航回调依赖，避免迁移后闭包引用失效
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { apiListModels } from '../../api/config';
import { getCacheCount, getDraft } from '../../utils/scriptDraftCache';
import { ensureScriptInputStyle } from './ScriptInputStyles';
import EpisodeCountSelector from './EpisodeCountSelector';
import FileCard from './FileCard';
import ModelSelector from './ModelSelector';
import SendButton from './SendButton';
import UploadPlaceholder from './UploadPlaceholder';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif";

function InputCard({ onSend, onStop, restoreText = '', restoreFiles = [], selectedModel, onModelChange, episodeCount, onEpisodeCountChange, width = '700px', disabled = false, projectId = '', showToast }) {
  const [text, setText] = useState(restoreText); // 挂载时使用 restoreText 作为初始值（超时回到空状态时预填充）
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [files, setFiles] = useState(restoreFiles);
  const [models, setModels] = useState([]);
  const prevDisabledRef = useRef(false);
  const cacheNavIndex = useRef(-1);

  useEffect(() => {
    ensureScriptInputStyle();
  }, []);

  useEffect(() => {
    // 仅在输入卡片挂载时加载模型；默认模型回调由本次加载结果触发。
    apiListModels({ category: 'chat' }).then((list) => {
      if (Array.isArray(list) && list.length > 0) {
        setModels(list);
        if (!selectedModel) { const def = list.find(m => m.is_default === true) || list[0]; onModelChange?.(def.model_id); }
      }
    }).catch(() => {});
  }, [onModelChange, selectedModel]);

  useEffect(() => {
    if (prevDisabledRef.current && !disabled) {
      setText(restoreText);
      setFiles(restoreFiles);
    }
    prevDisabledRef.current = disabled;
  }, [disabled, restoreText, restoreFiles]);

  const handleFileSelect = (newFiles) => setFiles((prev) => [...prev, ...newFiles]);
  const handleRemoveFile = (index) => setFiles((prev) => prev.filter((_, itemIndex) => itemIndex !== index));

  const canSend = !disabled && (text.trim() || files.length > 0);

  const handleSend = () => {
    if (!canSend) return;
    cacheNavIndex.current = -1;
    onSend(text.trim(), files, selectedModel, episodeCount);
    setText('');
    setFiles([]);
  };

  const handleStop = () => {
    onStop?.();
  };

  // 方向键上 + Shift：回退到历史暂存输入
  const handleNavigateCache = useCallback(async () => {
    const count = await getCacheCount(projectId);
    if (count === 0) {
      showToast?.('请先创作剧本', 'warning');
      return;
    }

    const newIndex = cacheNavIndex.current + 1;
    if (newIndex >= 10) {
      showToast?.('没有更多了！最多为您保存近10次剧本创作指令', 'warning');
      return;
    }
    if (newIndex >= count) {
      showToast?.('没有更多了', 'warning');
      return;
    }

    const draft = await getDraft(projectId, newIndex);
    if (draft) {
      setText(draft.text);
      if (draft.files?.length) setFiles(draft.files);
      if (draft.modelId) onModelChange(draft.modelId);
      if (draft.episodeCount != null) onEpisodeCountChange(draft.episodeCount);
      cacheNavIndex.current = newIndex;
    }
  }, [onEpisodeCountChange, onModelChange, projectId, showToast]);

  // Shift+Down: 向前切换到更新的暂存输入
  const handleNavigateCacheBack = useCallback(async () => {
    const count = await getCacheCount(projectId);
    if (count === 0) {
      showToast?.('请先创作剧本', 'warning');
      return;
    }

    const newIndex = cacheNavIndex.current - 1;
    if (newIndex < 0) {
      showToast?.('已经是最近的一条了', 'warning');
      return;
    }

    const draft = await getDraft(projectId, newIndex);
    if (draft) {
      setText(draft.text);
      if (draft.files?.length) setFiles(draft.files);
      if (draft.modelId) onModelChange(draft.modelId);
      if (draft.episodeCount != null) onEpisodeCountChange(draft.episodeCount);
      cacheNavIndex.current = newIndex;
    }
  }, [onEpisodeCountChange, onModelChange, projectId, showToast]);

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown' && e.shiftKey) {
      e.preventDefault();
      handleNavigateCacheBack();
      return;
    }
    if (e.key === 'ArrowUp' && e.shiftKey) {
      e.preventDefault();
      handleNavigateCache();
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isTyping = focused;
  const hoverBg = 'conic-gradient(from var(--chatbox-angle), oklab(86.8% -0.081 -0.057 / 30%) 0%, oklab(75.5% -0.102 -0.072 / 25%) 15%, oklab(75.5% -0.102 -0.072 / 0%) 50%, oklab(100% 0 0 / 5%) 55%, oklab(86.8% -0.081 -0.057 / 30%) 100%)';
  const idleBg = 'linear-gradient(in oklab 161.1deg, oklab(86.8% -0.081 -0.057 / 30%) 9.06%, oklab(75.5% -0.102 -0.072 / 25%) 15.35%, oklab(75.5% -0.102 -0.072 / 0%) 52.98%, oklab(100% 0 0 / 5%) 56.39%)';

  const wrapperStyle = (() => {
    if (isTyping) return { background: '#2DC3E1', animation: 'none' };
    if (hovered) return { backgroundImage: hoverBg, animation: 'chatbox-spin 4s linear infinite' };
    return { backgroundImage: idleBg, animation: 'none' };
  })();

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: '0px',
        borderRadius: '20px',
        justifyContent: 'flex-end',
        padding: '1px',
        width,
        ...wrapperStyle,
        boxShadow: '-5px -10px 50px #2DC3E11F',
        opacity: disabled ? 0.72 : 1,
        overflow: 'visible',
      }}
      onMouseEnter={() => !disabled && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: '0px',
          borderRadius: '19px',
          paddingTop: '16px',
          paddingBottom: '12px',
          flex: 1,
          alignSelf: 'stretch',
          background: '#131313',
          paddingLeft: '16px',
          paddingRight: '16px',
          overflow: 'visible',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '16px',
            alignSelf: 'stretch',
            height: '110px',
            flexShrink: 0,
            padding: 0,
            position: 'relative',
            overflow: 'visible',
          }}
        >
          {files.length > 0 && (
            <div style={{ position: 'absolute', left: 0, display: 'flex', alignItems: 'flex-start', gap: '8px', bottom: 'calc(100% + 24px)' }}>
              {files.map((file, index) => (
                <FileCard key={index} file={file} onRemove={() => handleRemoveFile(index)} disabled={disabled} />
              ))}
            </div>
          )}
          <UploadPlaceholder onFileSelect={handleFileSelect} disabled={disabled} />
          <textarea
            disabled={disabled}
            className="placeholder:text-[#FFFFFF66]"
            style={{
              flex: 1,
              alignSelf: 'stretch',
              resize: 'none',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              fontFamily: FONT,
              fontSize: '14px',
              lineHeight: '18px',
              color: text ? '#FFFFFFCC' : '#FFFFFF66',
            }}
            placeholder="支持.txt/.docx/.pdf/.md/.doc格式，最大 10MB，剧本不超过10w字符"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
          />
        </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0px', justifyContent: 'space-between', alignSelf: 'stretch' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: 0 }}>
            <ModelSelector
              label={selectedModel ? (models.find(m => m.model_id === selectedModel)?.name ?? selectedModel) : (models[0]?.name ?? '加载中…')}
              options={models.map(m => m.name)}
              width="200px"
              disabled={disabled}
              onSelect={(name) => {
                const m = models.find(m => m.name === name);
                if (m) onModelChange?.(m.model_id);
              }}
            />
            <EpisodeCountSelector value={episodeCount} onChange={(v) => onEpisodeCountChange?.(v)} disabled={disabled} />
          </div>
          <SendButton onClick={disabled ? handleStop : handleSend} disabled={!canSend && !disabled} loading={disabled && !onStop} isGenerating={disabled && !!onStop} />
        </div>
      </div>
    </div>
  );
}

export default InputCard;
