import { useEffect, useRef, useState } from 'react';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif";
const FONT_MEDIUM = "'AlibabaPuHuiTi_2_65_Medium','Alibaba PuHuiTi 2.0',system-ui,sans-serif";

function DownloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <path d="M2.667 11.333V13.333H13.333V11.333" stroke="rgba(255,255,255,0.8)" strokeLinecap="round" />
      <path d="M8 2.667V10.667" stroke="rgba(255,255,255,0.8)" strokeLinecap="round" />
      <path d="M5 7.667L8 10.667L11 7.667" stroke="rgba(255,255,255,0.8)" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <rect x="5.667" y="5.667" width="8.667" height="8.667" rx="1.5" stroke="rgba(255,255,255,0.8)" strokeLinejoin="round" />
      <path d="M10.333 5.667V4C10.333 3.079 9.587 2.333 8.667 2.333H4C3.079 2.333 2.333 3.079 2.333 4V8.667C2.333 9.587 3.079 10.333 4 10.333H5.667" stroke="rgba(255,255,255,0.8)" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <path d="M3 3.333V14.667H13V3.333H3Z" stroke="#F75F5F" strokeLinejoin="round" />
      <path d="M6.667 6.667V11M9.333 6.667V11M1.333 3.333H14.667M5.333 3.333L6.43 1.333H9.592L10.667 3.333H5.333Z" stroke="#F75F5F" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function RenameIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <path d="M11 2L14 5L5 14H2V11L11 2Z" stroke="rgba(255,255,255,0.8)" strokeLinejoin="round" />
      <path d="M10 3L13 6" stroke="rgba(255,255,255,0.8)" />
    </svg>
  );
}

function MoreIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="8" cy="4" r="1.2" fill="#fff" />
      <circle cx="8" cy="8" r="1.2" fill="#fff" />
      <circle cx="8" cy="12" r="1.2" fill="#fff" />
    </svg>
  );
}

/**
 * 资产库左侧项目列表项。
 * 组件只负责悬停、更多菜单和展示；项目重命名、复制、下载、删除由页面回调处理。
 */
export default function AssetsProjectListItem({
  project,
  active,
  onClick,
  onRename,
  onCopy,
  onDelete,
  onDownload,
}) {
  const [hovered, setHovered] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return undefined;

    function handleOutsideClick(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) setMenuOpen(false);
    }

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [menuOpen]);

  const menuItems = [
    { label: '重命名', icon: <RenameIcon />, action: onRename },
    { label: '复制项目', icon: <CopyIcon />, action: onCopy },
    { label: '下载项目', icon: <DownloadIcon />, action: onDownload },
    { label: '删除', icon: <TrashIcon />, action: onDelete, danger: true },
  ];

  function handleMenuAction(action) {
    setMenuOpen(false);
    action?.();
  }

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
        backgroundColor: active ? '#FFFFFF0F' : hovered ? '#FFFFFF08' : 'transparent',
        cursor: 'pointer',
        transition: 'background-color 0.12s',
        position: 'relative',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setMenuOpen(false); }}
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
        }}>{project?.name || '未命名项目'}</span>
      </button>

      <div ref={menuRef} style={{ position: 'relative', flexShrink: 0 }}>
        {hovered && (
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
            onMouseEnter={(event) => { if (!menuOpen) event.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.65)'; }}
            onMouseLeave={(event) => { if (!menuOpen) event.currentTarget.style.backgroundColor = '#00000080'; }}
            onClick={(event) => { event.stopPropagation(); setMenuOpen((value) => !value); }}
            aria-label="更多操作"
          >
            <MoreIcon />
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
            onClick={(event) => event.stopPropagation()}
          >
            {menuItems.map((item, index) => (
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
                  color: item.danger ? '#F75F5F' : 'rgba(255,255,255,0.8)',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
                onClick={() => handleMenuAction(item.action)}
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
