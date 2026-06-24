import { useState, useRef, useEffect } from 'react';
import TrashIcon from './TrashIcon';
import DownloadIcon from './DownloadIcon';
import { FONT, FONT_MEDIUM } from '../../utils/fonts';

export default function ProjectListItem({ project, active, onClick }) {
  const [hov, setHov] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [hovIdx, setHovIdx] = useState(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onDown(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [menuOpen]);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        width: '100%',
        paddingTop: '10px',
        paddingBottom: '10px',
        paddingLeft: '12px',
        paddingRight: '12px',
        borderRadius: '8px',
        backgroundColor: active ? '#FFFFFF0F' : hov ? '#FFFFFF08' : 'transparent',
        cursor: 'pointer',
        transition: 'background-color 0.12s',
        position: 'relative',
      }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => { setHov(false); setMenuOpen(false); }}
    >
      <button
        type="button"
        style={{
          flex: 1,
          background: 'none',
          border: 'none',
          padding: 0,
          textAlign: 'left',
          cursor: 'pointer',
          minWidth: 0,
        }}
        onClick={onClick}
      >
        <span style={{
          display: 'block',
          fontFamily: active ? FONT_MEDIUM : FONT,
          fontWeight: active ? 500 : 400,
          fontSize: '14px',
          color: active ? '#FFFFFF' : '#FFFFFF99',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>{project.name}</span>
      </button>

      {/* hover more button */}
      <div ref={menuRef} style={{ position: 'relative', flexShrink: 0 }}>
        {hov && (
          <button
            type="button"
            style={{
              position: 'absolute',
              top: '50%',
              right: 0,
              transform: 'translateY(-50%)',
              width: '24px',
              height: '24px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: menuOpen ? 'rgba(255,255,255,0.15)' : '#00000080',
              border: 'none',
              cursor: 'pointer',
              transition: 'background-color 0.12s',
              flexShrink: 0,
            }}
            onMouseEnter={(e) => { if (!menuOpen) e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.65)'; }}
            onMouseLeave={(e) => { if (!menuOpen) e.currentTarget.style.backgroundColor = '#00000080'; }}
            onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
            aria-label="更多操作"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
              <circle cx="8" cy="4" r="1.2" fill="#fff" />
              <circle cx="8" cy="8" r="1.2" fill="#fff" />
              <circle cx="8" cy="12" r="1.2" fill="#fff" />
            </svg>
          </button>
        )}
        {menuOpen && (
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 4px)',
              right: 0,
              zIndex: 50,
              minWidth: '110px',
              padding: '4px',
              borderRadius: '8px',
              backgroundColor: '#1C1C1C',
              border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0px 4px 16px rgba(0,0,0,0.5)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {[
              { label: '重命名', icon: (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                  <path d="M11 2L14 5L5 14H2V11L11 2Z" stroke="rgba(255,255,255,0.8)" strokeLinejoin="round" />
                  <path d="M10 3L13 6" stroke="rgba(255,255,255,0.8)" />
                </svg>
              ), action: () => { setMenuOpen(false); project.onRename?.(); }, danger: false },
              { label: '删除', icon: <TrashIcon color="#F75F5F" />, action: () => { setMenuOpen(false); project.onDelete?.(); }, danger: true },
              { label: '下载项目', icon: <DownloadIcon color="rgba(255,255,255,0.8)" />, action: () => { setMenuOpen(false); project.onDownload?.(); }, danger: false },
            ].map((item, i) => (
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
                  color: item.danger ? '#F75F5F' : 'rgba(255,255,255,0.8)',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={() => setHovIdx(i)}
                onMouseLeave={() => setHovIdx(null)}
                onClick={item.action}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
