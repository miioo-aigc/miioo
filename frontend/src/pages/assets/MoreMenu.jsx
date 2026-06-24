import { useState, useEffect, useRef } from 'react';
import { FONT } from '../../utils/fonts';
import GhostBtn from '../../components/GhostBtn';
import ConfirmDialog from '../../components/ConfirmDialog';
import DownloadIcon from './DownloadIcon';
import TrashIcon from './TrashIcon';

export default function MoreMenu({ onDownload, onDelete }) {
  const [open, setOpen] = useState(false);
  const [hovIdx, setHovIdx] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const items = [
    { label: '下载', icon: <DownloadIcon />, action: () => { onDownload?.(); setOpen(false); }, danger: false },
    { label: '删除', icon: <TrashIcon />, action: () => { setOpen(false); setShowConfirm(true); }, danger: true },
  ];

  return (
    <div ref={ref} style={{ position: 'relative' }}>
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
        onMouseEnter={(e) => { if (!open) e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.65)'; }}
        onMouseLeave={(e) => { if (!open) e.currentTarget.style.backgroundColor = '#00000080'; }}
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        aria-label="更多操作"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
          <circle cx="8" cy="4" r="1" fill="#fff" />
          <circle cx="8" cy="8" r="1" fill="#fff" />
          <circle cx="8" cy="12" r="1" fill="#fff" />
        </svg>
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
          {items.map((item, i) => (
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
                background: hovIdx === i ? 'rgba(255,255,255,0.08)' : 'transparent',
                cursor: 'pointer',
                fontFamily: FONT,
                fontSize: '14px',
                lineHeight: '18px',
                color: item.danger ? '#FF6B6B' : 'rgba(255,255,255,0.8)',
                transition: 'background 0.1s',
              }}
              onMouseEnter={() => setHovIdx(i)}
              onMouseLeave={() => setHovIdx(null)}
              onClick={(e) => { e.stopPropagation(); item.action(); }}
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

