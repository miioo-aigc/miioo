const FONT_REGULAR = "'AlibabaPuHuiTi_2_55_Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif";
const FONT_MEDIUM = "'AlibabaPuHuiTi_2_65_Medium','Alibaba PuHuiTi 2.0',system-ui,sans-serif";

function AlertIcon({ color }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 14.667C9.841 14.667 11.508 13.921 12.714 12.714C13.921 11.508 14.667 9.841 14.667 8C14.667 6.159 13.921 4.492 12.714 3.286C11.508 2.08 9.841 1.333 8 1.333C6.159 1.333 4.492 2.08 3.286 3.286C2.08 4.492 1.333 6.159 1.333 8C1.333 9.841 2.08 11.508 3.286 12.714C4.492 13.921 6.159 14.667 8 14.667Z" fill={color} stroke={color} strokeWidth="1.333" />
      <path d="M8 4V9.333M8 11.5V11.501" stroke="#FFFFFF" strokeWidth="1.333" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M2.667 2.667L13.333 13.333M13.333 2.667L2.667 13.333" stroke="#FFFFFF" strokeLinecap="round" /></svg>;
}

export default function StorageUsageReminderModal({ type, onClose, onManageAssets }) {
  if (!type) return null;
  const isFull = type === 'full';
  const color = isFull ? '#D13B3B' : '#F7A33B';
  return (
    <div style={{ alignItems: 'center', background: 'rgba(0,0,0,0.45)', display: 'flex', inset: 0, justifyContent: 'center', position: 'fixed', zIndex: 10000 }}>
      <div role="alertdialog" aria-modal="true" style={{ backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', backgroundColor: isFull ? '#D13B3B1A' : '#EB8B141A', border: `1px solid ${color}`, borderRadius: '16px', color: '#FFFFFF', fontFamily: FONT_REGULAR, width: '400px', maxWidth: 'calc(100vw - 32px)', overflow: 'hidden' }}>
        <div style={{ alignItems: 'center', display: 'flex', gap: '8px', justifyContent: 'space-between', padding: '16px 24px' }}>
          <div style={{ alignItems: 'center', display: 'flex', gap: '8px' }}><AlertIcon color={color} /><span style={{ color, fontFamily: FONT_MEDIUM, fontSize: '16px', lineHeight: '20px' }}>{isFull ? '存储空间已满' : '存储空间不足'}</span></div>
          <button type="button" aria-label="关闭" onClick={onClose} style={{ background: 'transparent', border: 0, cursor: 'pointer', padding: 0, height: '16px', width: '16px' }}><CloseIcon /></button>
        </div>
        <div style={{ fontSize: '16px', lineHeight: '20px', padding: '8px 24px 24px' }}>{isFull ? '存储空间已满，请清理后使用。' : '可用存储空间不足1G，为避免影响您的使用，请及时清理。'}</div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 24px 16px' }}><button type="button" onClick={onManageAssets} style={{ background: color, border: 0, borderRadius: '8px', color: isFull ? '#FFFFFF' : '#090909', cursor: 'pointer', fontFamily: FONT_MEDIUM, fontSize: '14px', height: '36px', lineHeight: '20px', padding: '0 16px' }}>管理资产</button></div>
      </div>
    </div>
  );
}
