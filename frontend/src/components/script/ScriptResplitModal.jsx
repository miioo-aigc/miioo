/**
 * @file ScriptResplitModal.jsx
 * @structure-index
 *
 * ─── 组件职责 ───────────────────────────────────────────────────────
 *   收集 AI 重新分集的目标集数与分集逻辑，并通过 props 提交参数
 *   使用通用 TextField、Tabs 和 Button，不直接调用接口
 *
 * ─── 更新记录 ───────────────────────────────────────────────────────
 *   2026-07-22  新增 AI 重新分集独立弹窗
 *   2026-07-22  接入异步操作提交状态，失败时保留弹窗并展示错误
 *   2026-07-22  当前集数恢复禁用态，目标集数支持输入框与单位，遮罩增加背景模糊
 *   2026-07-22  分集逻辑输入框高度固定为 160px，并移除禁用态悬停反馈
 *   2026-07-22  隐藏当前集数展示，目标集数默认继承当前剧集数量
 *   2026-07-22  提交后保留遮罩并展示 200px 加载动画，失败时恢复弹窗
 *   2026-07-27  处理中将加载遮罩限制在剧本内容区，弹窗打开态仍保持全屏遮罩
 *   2026-08-04  目标集数选项增加两侧计步器，数字和单位居中展示
 */
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Button, Tabs, TextField } from '../ui';
import ScriptActionLoadingOverlay from './ScriptActionLoadingOverlay';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif";
const FONT_MEDIUM = "'AlibabaPuHuiTi_2_65_Medium','Alibaba_PuHuiTi_2.0',system-ui,sans-serif";

function CloseIcon() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M2.667 2.667L13.333 13.333M13.333 2.667L2.667 13.333" stroke="currentColor" strokeLinecap="round" /></svg>;
}

export default function ScriptResplitModal({ open, currentEpisodeCount = 0, selectedModel, submitting = false, error = '', onSubmit, onClose, loadingContainerRef }) {
  const [targetMode, setTargetMode] = useState('count');
  const [targetCount, setTargetCount] = useState(String(currentEpisodeCount));
  const [instruction, setInstruction] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const adjustTargetCount = (delta) => {
    const current = Number.parseInt(targetCount, 10);
    const base = Number.isNaN(current) ? 1 : current;
    setTargetCount(String(Math.max(1, base + delta)));
  };

  if (!open) return null;

  const handleSubmit = async () => {
    setSubmitted(true);
    try {
      const succeeded = await onSubmit?.({
        episode_count: targetMode === 'auto' ? null : Number(targetCount),
        instruction: instruction.trim(),
        model: selectedModel || null,
      });
      setSubmitted(false);
      if (succeeded) onClose?.();
    } catch (submitError) {
      setSubmitted(false);
      throw submitError;
    }
  };

  const isProcessing = submitted || submitting;

  return createPortal(
    <div
      role="presentation"
      onMouseDown={(event) => { if (event.target === event.currentTarget && !isProcessing) { setSubmitted(false); onClose?.(); } }}
      style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: isProcessing ? 'transparent' : 'rgba(0,0,0,0.62)', backdropFilter: isProcessing ? 'none' : 'blur(8px)', WebkitBackdropFilter: isProcessing ? 'none' : 'blur(8px)', pointerEvents: isProcessing ? 'none' : 'auto' }}
    >
      {!isProcessing && <div role="dialog" aria-modal="true" aria-labelledby="script-resplit-title" style={{ display: 'flex', width: '400px', maxWidth: 'calc(100vw - 32px)', flexDirection: 'column', overflow: 'hidden', borderRadius: '16px', background: '#161616', boxShadow: '0 8px 32px rgba(0,0,0,0.6)', fontFamily: FONT, color: '#FFFFFF' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', padding: '16px 24px' }}>
          <h2 id="script-resplit-title" style={{ flex: 1, margin: 0, fontFamily: FONT_MEDIUM, fontSize: '16px', lineHeight: '20px', fontWeight: 500 }}>AI重新分集</h2>
          <button type="button" aria-label="关闭" onClick={() => { setSubmitted(false); onClose?.(); }} disabled={isProcessing} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', padding: 0, border: 0, borderRadius: '6px', background: 'transparent', color: '#FFFFFF', cursor: isProcessing ? 'not-allowed' : 'pointer' }}><CloseIcon /></button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '8px 24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ color: '#FFFFFF99', fontSize: '13px', lineHeight: '18px' }}>目标集数</span>
            <Tabs
              variant="resplit"
              options={[{ value: 'count', label: '目标集数', input: true, stepper: true, suffix: '集', inputAriaLabel: '目标集数' }, { value: 'auto', label: '自适应' }]}
              value={targetMode}
              onChange={setTargetMode}
              inputValue={targetCount}
              onInputChange={setTargetCount}
              onInputStep={adjustTargetCount}
              gap="16px"
            />
          </div>
          <TextField
            label="分集逻辑"
            value={instruction}
            multiline
            height="160px"
            placeholder="AI会根据当前所有剧集正文重新分集，请描述希望按集数、剧情节点、钩子节奏或场景关系如何拆分……"
            onChange={(event) => setInstruction(event.target.value)}
          />
          {error && <div role="alert" style={{ color: '#F75F5F', fontSize: '12px', lineHeight: '18px' }}>{error}</div>}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', padding: '16px 24px' }}>
          <Button type="button" variant="secondary" onClick={() => { setSubmitted(false); onClose?.(); }} disabled={isProcessing}>取消</Button>
          <Button type="button" variant="primary" onClick={handleSubmit} disabled={isProcessing}>开始拆分</Button>
        </div>
      </div>}
      {isProcessing && <ScriptActionLoadingOverlay containerRef={loadingContainerRef} />}
    </div>,
    document.body,
  );
}
