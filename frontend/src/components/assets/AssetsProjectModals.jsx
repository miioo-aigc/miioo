import { Button, IconButton, TextField } from '../ui';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif";
const FONT_MEDIUM = "'AlibabaPuHuiTi_2_65_Medium','Alibaba PuHuiTi 2.0',system-ui,sans-serif";

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M2.667 2.667L13.333 13.333" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2.667 13.333L13.333 2.667" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ModalShell({ children, onClose, width, className = '' }) {
  return (
    <div
      className={className}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
      onClick={onClose}
    >
      <div
        style={{ width, background: '#161616', borderRadius: '16px', overflow: 'hidden' }}
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function CloseButton({ onClick }) {
  return (
    <IconButton
      variant="link"
      size="small"
      onClick={onClick}
      aria-label="关闭"
      icon={<CloseIcon />}
      className="!h-[28px] !w-[28px] !rounded-[8px] !p-0 !shadow-none"
      contentClassName="!h-full !w-full !p-0"
    />
  );
}

export function AssetsProjectRenameModal({ value, onChange, onClose, onConfirm }) {
  const canConfirm = Boolean(value.trim());

  return (
    <ModalShell onClose={onClose} width="400px">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', background: '#161616' }}>
        <span style={{ fontFamily: FONT_MEDIUM, fontWeight: 500, fontSize: '16px', lineHeight: '20px', color: '#FFFFFF' }}>
          重命名
        </span>
        <CloseButton onClick={onClose} />
      </div>

      <div style={{ padding: '8px 24px', background: '#161616' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: 'rgba(255,255,255,0.6)' }}>
            项目名称
          </span>
          <TextField
            autoFocus
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') onConfirm();
              if (event.key === 'Escape') onClose();
            }}
            wrapperClassName="!gap-0"
            inputClassName="!font-normal !caret-[#2DC3E1]"
          />
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', padding: '16px 24px', background: '#161616' }}>
        <Button variant="secondary" size="large" onClick={onClose}>取消</Button>
        <Button variant="primary" size="large" disabled={!canConfirm} onClick={canConfirm ? onConfirm : undefined}>确认</Button>
      </div>
    </ModalShell>
  );
}
