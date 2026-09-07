import { useEffect, useRef, useState } from 'react';
import ConfirmDialog from '../ConfirmDialog';
import { DeleteIcon } from '../ui';

function DownloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <path d="M2.667 11.333V13.333H13.333V11.333" stroke="#FFFFFF" strokeLinecap="round" />
      <path d="M8 2.667V10.667" stroke="#FFFFFF" strokeLinecap="round" />
      <path d="M5 7.667L8 10.667L11 7.667" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MoreIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="8" cy="4" r="1" fill="#fff" />
      <circle cx="8" cy="8" r="1" fill="#fff" />
      <circle cx="8" cy="12" r="1" fill="#fff" />
    </svg>
  );
}

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif";

/**
 * 资产卡片的更多操作菜单。
 * 下载由调用方执行；删除只负责发出确认后的回调，不接触资产 API 或页面状态。
 */
export default function AssetsMoreMenu({ onDownload, onDelete }) {
  const [open, setOpen] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    function handleOutsideClick(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) setOpen(false);
    }

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [open]);

  const items = [
    { label: '下载', icon: <DownloadIcon />, action: () => { onDownload?.(); setOpen(false); } },
    { label: '删除', icon: <DeleteIcon size={16} color="currentColor" />, action: () => { setOpen(false); setShowConfirm(true); }, danger: true },
  ];

  return (
    <div ref={menuRef} style={{ position: 'relative' }}>
      <button
        type="button"
        style={{
          width: '24px',
          height: '24px',
          borderRadius: '6px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: open ? 'rgba(0,0,0,0.75)' : '#00000080',
          border: 'none',
          cursor: 'pointer',
          transition: 'background-color 0.12s',
          flexShrink: 0,
        }}
        onMouseEnter={(event) => { if (!open) event.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.65)'; }}
        onMouseLeave={(event) => { if (!open) event.currentTarget.style.backgroundColor = '#00000080'; }}
        onClick={(event) => { event.stopPropagation(); setOpen((value) => !value); }}
        aria-label="更多操作"
      >
        <MoreIcon />
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            right: 0,
            zIndex: 50,
            minWidth: '100px',
            padding: '4px',
            borderRadius: '8px',
            backgroundColor: '#1C1C1C',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0px 4px 16px rgba(0,0,0,0.5)',
          }}
        >
          {items.map((item, index) => (
            <button
              key={item.label}
              type="button"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                width: '100%',
                padding: '8px 10px',
                borderRadius: '6px',
                border: 'none',
                background: hoveredIndex === index ? 'rgba(255,255,255,0.08)' : 'transparent',
                cursor: 'pointer',
                fontFamily: FONT,
                fontSize: '14px',
                lineHeight: '18px',
                color: item.danger ? '#FF6B6B' : 'rgba(255,255,255,0.8)',
                transition: 'background 0.1s',
              }}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
              onClick={(event) => { event.stopPropagation(); item.action(); }}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      )}

      {showConfirm && (
        <ConfirmDialog
          title="确定要删除吗？"
          description="删除后，该资产将被清除且不可恢复。"
          confirmText="删除"
          onCancel={() => setShowConfirm(false)}
          onConfirm={() => { setShowConfirm(false); onDelete?.(); }}
          zIndex={100}
        />
      )}
    </div>
  );
}
