/**
 * @file ScriptModifyConfirmModal.jsx
 * @structure-index
 *
 * ─── 组件职责 ───────────────────────────────────────────────────────
 *   展示进入剧本修改态前的风险确认，不管理页面状态或接口请求
 *
 * ─── 更新记录 ───────────────────────────────────────────────────────
 *   2026-07-22  新增剧本修改二次确认弹窗
 */
import { createPortal } from 'react-dom';
import { Button } from '../ui';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif";
const FONT_MEDIUM = "'AlibabaPuHuiTi_2_65_Medium','Alibaba_PuHuiTi_2.0',system-ui,sans-serif";

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2.667 2.667L13.333 13.333" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2.667 13.333L13.333 2.667" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function ScriptModifyConfirmModal({ open, onConfirm, onCancel }) {
  if (!open) return null;

  return createPortal(
    <div
      role="presentation"
      onClick={onCancel}
      style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-surface-overlay)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="script-modify-confirm-title"
        onClick={(event) => event.stopPropagation()}
        style={{ width: '400px', maxWidth: 'calc(100vw - 32px)', overflow: 'hidden', borderRadius: '16px', background: '#161616', color: '#FFFFFF', fontFamily: FONT, fontSynthesis: 'none', boxShadow: '0 8px 32px rgba(0,0,0,0.6)' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', padding: '16px 24px' }}>
          <h2 id="script-modify-confirm-title" style={{ flex: 1, margin: 0, color: '#FFFFFF', fontFamily: FONT_MEDIUM, fontSize: '16px', lineHeight: '20px', fontWeight: 500 }}>确定要修改剧本吗？</h2>
          <button type="button" aria-label="关闭" onClick={onCancel} style={{ display: 'flex', width: '24px', height: '24px', flexShrink: 0, alignItems: 'center', justifyContent: 'center', padding: 0, border: 0, borderRadius: '6px', background: 'transparent', cursor: 'pointer' }}><CloseIcon /></button>
        </div>
        <div style={{ padding: '8px 24px 12px' }}>
          <p style={{ margin: 0, color: '#FFFFFF', fontSize: '16px', lineHeight: '20px' }}>修改剧本内容后，系统会重新抽取主体和分镜，您当前生成的内容将会消失，请提前做好项目备份</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '16px', padding: '16px 24px' }}>
          <Button type="button" variant="secondary" onClick={onCancel}>取消</Button>
          <Button type="button" variant="accent" onClick={onConfirm} style={{ background: '#EB8B14', backgroundImage: 'none', borderColor: '#FFFFFF33' }} contentClassName="!text-white">确认修改</Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
