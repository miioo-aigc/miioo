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
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '28px',
        height: '28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        borderRadius: '8px',
        padding: 0,
        flexShrink: 0,
      }}
      aria-label="关闭"
    >
      <CloseIcon />
    </button>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '36px', paddingLeft: '12px', paddingRight: '6px', borderRadius: '8px', background: '#1D1E1E', border: '1px solid rgba(255,255,255,0.08)', outline: '1px solid #00000080', outlineOffset: '0' }}>
            <input
              autoFocus
              value={value}
              onChange={(event) => onChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') onConfirm();
                if (event.key === 'Escape') onClose();
              }}
              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: '#FFFFFF', caretColor: '#2DC3E1' }}
            />
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', padding: '16px 24px', background: '#161616' }}>
        <button
          type="button"
          onClick={onClose}
          style={{ display: 'flex', alignItems: 'center', height: '36px', flexShrink: 0, borderRadius: '8px', padding: '0 16px', gap: '4px', boxShadow: 'rgba(0,0,0,0.4) 3px 3px 8px', background: '#161616', border: '1px solid rgba(255,255,255,0.05)', outline: '1px solid #00000080', cursor: 'pointer', fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: 'rgba(255,255,255,0.6)' }}
        >
          取消
        </button>
        <button
          type="button"
          disabled={!canConfirm}
          onClick={canConfirm ? onConfirm : undefined}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '36px', flexShrink: 0, borderRadius: '8px', padding: '0 16px', boxShadow: 'rgba(0,0,0,0.4) 3px 3px 8px', outline: '1px solid #00000080', border: 'none', background: canConfirm ? '#1D1E1E' : '#161616', opacity: canConfirm ? 1 : 0.5, cursor: canConfirm ? 'pointer' : 'not-allowed', fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: '#FFFFFF' }}
        >
          确认
        </button>
      </div>
    </ModalShell>
  );
}
