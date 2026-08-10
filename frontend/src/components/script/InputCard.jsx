/**
 * @file InputCard.jsx
 * @structure-index
 *
 * ─── 状态层 ─────────────────────────────────────────────────────────
 *   输入文本、模型列表、单集时长、焦点/悬停态
 *
 * ─── 数据流 ─────────────────────────────────────────────────────────
 *   模型 API；通过 onSend/onStop 和选择回调通知页面
 *
 * ─── 组件结构 ───────────────────────────────────────────────────────
 *   Select / EpisodeCountSelector / EpisodeDurationSelector / SendButton
 *
 * ─── 更新记录 ───────────────────────────────────────────────────────
 *   2026-07-15  从 ScriptPage 抽离会话输入区，保持输入和发送行为不变
 *   2026-07-21  移除输入卡上传能力，增加单集时长选择
 *   2026-07-21  模型、时长和集数统一复用 Select UI 组件
 *   2026-07-21  集数选择保留数字输入和加减按钮的自定义菜单
 *   2026-07-21  删除本地创作指令历史缓存与方向键回溯
 *   2026-08-04  避免中文输入法候选阶段按 Enter 误触发发送
 *   2026-08-10  剧本生成中保持输入可用，非空输入直接交由页面发送到后端
 */
import { useEffect, useRef, useState } from 'react';
import { apiListModels } from '../../api/config';
import { Select } from '../ui';
import { ensureScriptInputStyle } from './ScriptInputStyles';
import EpisodeCountSelector from './EpisodeCountSelector';
import EpisodeDurationSelector from './EpisodeDurationSelector';
import SendButton from './SendButton';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif";
function InputCard({ onSend, onStop, restoreText = '', selectedModel, onModelChange, episodeCount, onEpisodeCountChange, episodeDuration = 60, onEpisodeDurationChange, width = '700px', disabled = false }) {
  const [text, setText] = useState(restoreText); // 挂载时使用 restoreText 作为初始值（超时回到空状态时预填充）
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [models, setModels] = useState([]);
  const prevDisabledRef = useRef(false);
  const composingRef = useRef(false);

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
    }
    prevDisabledRef.current = disabled;
  }, [disabled, restoreText]);

  const hasText = Boolean(text.trim());

  const handleSend = async () => {
    // 忙碌态也允许发送，后端负责判断任务冲突并返回真实错误。
    if (!hasText) return;
    const sent = await onSend(text.trim(), selectedModel, episodeCount, episodeDuration);
    if (sent !== false) setText('');
  };

  const handleStop = () => {
    onStop?.();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      // 输入法候选阶段的 Enter 用于确认拼音，不能提交当前消息。
      // keyCode 229 兼容部分浏览器未及时同步 nativeEvent.isComposing 的情况。
      if (composingRef.current || e.nativeEvent.isComposing || e.keyCode === 229) return;
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
          <textarea
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
            placeholder="在此输入你构想的故事内容，AI自动生成剧本"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            onCompositionStart={() => { composingRef.current = true; }}
            onCompositionEnd={() => { composingRef.current = false; }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
          />
        </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0px', justifyContent: 'space-between', alignSelf: 'stretch' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: 0 }}>
            <Select
              value={selectedModel ?? ''}
              displayValue={selectedModel ? (models.find(m => m.model_id === selectedModel)?.name ?? selectedModel) : (models[0]?.name ?? '加载中…')}
              options={models.map(m => ({ value: m.model_id, label: m.name }))}
              width="200px"
              disabled={disabled}
              loading={models.length === 0}
              onChange={onModelChange}
              menuPlacement="up"
            />
            <EpisodeDurationSelector value={episodeDuration} onChange={onEpisodeDurationChange} disabled={disabled} />
            <EpisodeCountSelector value={episodeCount} onChange={onEpisodeCountChange} disabled={disabled} />
          </div>
          <SendButton
            // 有输入时始终进入页面层 handleSend，直接发送到后端剧本对话接口。
            onClick={hasText ? handleSend : handleStop}
            disabled={!hasText}
            loading={disabled && !hasText}
            paused={disabled && !hasText && !!onStop}
          />
        </div>
      </div>
    </div>
  );
}

export default InputCard;
