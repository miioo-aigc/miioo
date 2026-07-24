/**
 * @file AIRegenerateStoryboardModal.jsx
 * @structure-index
 *
 * ─── 组件职责 ───────────────────────────────────────────────────────
 *   收集 AI 重新分镜要求，并通过 props 触发当前分集的重新分镜动作
 *
 * ─── 依赖边界 ───────────────────────────────────────────────────────
 *   复用通用 TextField、Button；不读取页面状态，不直接调用 API。
 */
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Button, TextField } from '../ui';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi 2.0',system-ui,sans-serif";
const FONT_MEDIUM = "'AlibabaPuHuiTi_2_65_Medium','Alibaba_PuHuiTi 2.0',system-ui,sans-serif";

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2.667 2.667L13.333 13.333" stroke="currentColor" strokeLinecap="round" />
      <path d="M2.667 13.333L13.333 2.667" stroke="currentColor" strokeLinecap="round" />
    </svg>
  );
}

export default function AIRegenerateStoryboardModal({ open, submitting = false, error = '', onSubmit, onClose }) {
  const [instruction, setInstruction] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const isProcessing = submitted || submitting;

  if (!open) return null;

  const close = () => {
    if (!isProcessing) onClose?.();
  };

  const submit = async () => {
    if (isProcessing) return;
    setSubmitted(true);
    try {
      const succeeded = await onSubmit?.({ instruction: instruction.trim() });
      if (succeeded !== false) onClose?.();
    } catch {
      // 失败时保留弹窗，错误信息由页面回传。
    } finally {
      setSubmitted(false);
    }
  };

  return createPortal(
    <div
      role="presentation"
      onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0, 0, 0, 0.62)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
    >
      <div role="dialog" aria-modal="true" aria-labelledby="ai-regenerate-storyboard-title" style={{ display: 'flex', width: '400px', maxWidth: 'calc(100vw - 32px)', flexDirection: 'column', overflow: 'hidden', borderRadius: '16px', background: '#161616', boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)', fontFamily: FONT, color: '#FFFFFF' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', padding: '16px 24px', background: '#161616' }}>
          <h2 id="ai-regenerate-storyboard-title" style={{ flex: 1, margin: 0, fontFamily: FONT_MEDIUM, fontSize: '16px', lineHeight: '20px', fontWeight: 500 }}>AI重新分镜</h2>
          <button type="button" aria-label="关闭" onClick={close} disabled={isProcessing} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', padding: 0, border: 0, borderRadius: '6px', background: 'transparent', color: '#FFFFFF', cursor: isProcessing ? 'not-allowed' : 'pointer' }}><CloseIcon /></button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '8px 24px', background: '#161616' }}>
          <TextField label="要求（选填）" value={instruction} multiline height="120px" placeholder="比如：剧情更紧凑一点；减少对白镜头；多一些人物情绪特写等。" onChange={(event) => setInstruction(event.target.value)} disabled={isProcessing} />
          <div style={{ color: '#D13B3B', fontSize: '14px', lineHeight: '18px', fontFamily: FONT }}>重新分镜会覆盖当前分镜，且无法撤回，请做好资产备份</div>
          {error && <div role="alert" style={{ color: '#F75F5F', fontSize: '12px', lineHeight: '18px', fontFamily: FONT }}>{error}</div>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '16px', padding: '16px 24px', background: '#161616' }}>
          <Button type="button" variant="secondary" size="large" onClick={close} disabled={isProcessing}>取消</Button>
          <Button type="button" variant="primary" size="large" onClick={submit} loading={isProcessing}>开始重新分镜</Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
