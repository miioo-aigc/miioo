/**
 * @file SubjectPanelHeader.jsx
 * @structure-index
 *
 * ─── 组件职责 ───────────────────────────────────────────────────────
 *   SubjectPanelHeader  主体编辑面板标题和关闭动作
 *
 * ─── 依赖边界 ───────────────────────────────────────────────────────
 *   只接收标题文案和关闭回调
 *   不调用 API、不读取 Store、不依赖 SubjectPage 内部状态
 *
 * ─── 更新记录 ───────────────────────────────────────────────────────
 *   2026-07-15  从 SubjectPage 的 EditSubjectPanel 抽离面板头部
 */
import { IconButton } from '../ui';

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <line x1="2" y1="2" x2="14" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="14" y1="2" x2="2" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export default function SubjectPanelHeader({ tabLabel = '角色', onClose }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingBlock: '20px',
        paddingInline: '24px',
        background: '#161616',
        flexShrink: 0,
      }}
    >
      <span style={{ fontFamily: "'AlibabaPuHuiTi_2_65_Medium','Alibaba PuHuiTi 2.0',system-ui,sans-serif", fontWeight: 500, fontSize: '16px', lineHeight: '20px', color: '#FFFFFF' }}>
        编辑{tabLabel}
      </span>
      <IconButton
        type="button"
        variant="secondary"
        size="small"
        aria-label={`关闭编辑${tabLabel}面板`}
        icon={<CloseIcon />}
        onClick={onClose}
        className="!size-[28px] !rounded-[6px] !border-0 !bg-transparent !shadow-none hover:!bg-white/10 active:!bg-white/10"
        contentClassName="!text-white/40 hover:!text-white/80"
      />
    </div>
  );
}
