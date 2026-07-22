/**
 * @file ScriptRewriteModal.jsx
 * @structure-index
 *
 * ─── 组件职责 ───────────────────────────────────────────────────────
 *   收集 AI 重写当前分集的长文本要求，并通过 props 提交异步操作
 *   使用通用 TextField 和 Button，不直接调用 API
 *
 * ─── 更新记录 ───────────────────────────────────────────────────────
 *   2026-07-22  新增 AI 重写本集独立弹窗，复用长文本输入框
 *   2026-07-22  提交后保留遮罩并展示 200px 加载动画，失败时恢复弹窗
 */
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Button, TextField } from '../ui';
import ScriptActionLoadingOverlay from './ScriptActionLoadingOverlay';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif";
const FONT_MEDIUM = "'AlibabaPuHuiTi_2_65_Medium','Alibaba_PuHuiTi_2.0',system-ui,sans-serif";

function CloseIcon() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M2.667 2.667L13.333 13.333M13.333 2.667L2.667 13.333" stroke="currentColor" strokeLinecap="round" /></svg>;
}

export default function ScriptRewriteModal({ open, submitting = false, error = '', onSubmit, onClose }) {
  const [instruction, setInstruction] = useState('');
  const [submitted, setSubmitted] = useState(false);

  if (!open) return null;

  const handleSubmit = async () => {
    setSubmitted(true);
    try {
      const succeeded = await onSubmit?.({ instruction: instruction.trim() });
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
      style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.62)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
    >
      {!isProcessing && <div role="dialog" aria-modal="true" aria-labelledby="script-rewrite-title" style={{ display: 'flex', width: '400px', maxWidth: 'calc(100vw - 32px)', flexDirection: 'column', overflow: 'hidden', borderRadius: '16px', background: '#161616', boxShadow: '0 8px 32px rgba(0,0,0,0.6)', fontFamily: FONT, color: '#FFFFFF' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', padding: '16px 24px' }}>
          <h2 id="script-rewrite-title" style={{ flex: 1, margin: 0, fontFamily: FONT_MEDIUM, fontSize: '16px', lineHeight: '20px', fontWeight: 500 }}>AI重写本集</h2>
          <button type="button" aria-label="关闭" onClick={() => { setSubmitted(false); onClose?.(); }} disabled={isProcessing} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', padding: 0, border: 0, borderRadius: '6px', background: 'transparent', color: '#FFFFFF', cursor: isProcessing ? 'not-allowed' : 'pointer' }}><CloseIcon /></button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '8px 24px' }}>
          <TextField
            label="重写逻辑"
            value={instruction}
            multiline
            height="160px"
            placeholder="请描述希望修改的剧情，更紧凑一点、更温馨一点，或者增加出场人物等等"
            onChange={(event) => setInstruction(event.target.value)}
          />
          {error && <div role="alert" style={{ color: '#F75F5F', fontSize: '12px', lineHeight: '18px' }}>{error}</div>}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', padding: '16px 24px' }}>
          <Button type="button" variant="secondary" onClick={() => { setSubmitted(false); onClose?.(); }} disabled={isProcessing}>取消</Button>
          <Button type="button" variant="primary" onClick={handleSubmit} disabled={isProcessing}>开始重写</Button>
        </div>
      </div>}
      {isProcessing && <ScriptActionLoadingOverlay />}
    </div>,
    document.body,
  );
}
