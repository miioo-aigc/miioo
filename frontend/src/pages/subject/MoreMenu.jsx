import { useState, useRef, useEffect } from "react";
import { FONT } from "../../utils/fonts";
import GhostBtn from "../../components/GhostBtn";

export default 
function MoreMenu({ onDownload, onDelete }) {
  const [open, setOpen] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [hovIdx, setHovIdx] = useState(null);
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
    {
      label: '下载',
      icon: (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
          <path d="M2.667 11.333V13.333H13.333V11.333" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M8 2.667V10.667" stroke="currentColor" strokeLinecap="round" />
          <path d="M5 7.667L8 10.667L11 7.667" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
      action: () => { onDownload?.(); setOpen(false); },
      danger: false,
    },
    {
      label: '删除',
      icon: (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
          <path d="M3 3.333V14.667H13V3.333H3Z" stroke="currentColor" strokeLinejoin="round" />
          <path d="M6.667 6.667V11" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M9.333 6.667V11" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M1.333 3.333H14.667" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M5.333 3.333L6.43 1.333H9.592L10.667 3.333H5.333Z" stroke="currentColor" strokeLinejoin="round" />
        </svg>
      ),
      action: () => { setOpen(false); setShowConfirm(true); },
      danger: true,
    },
  ];

  return (
    <>
      <div ref={ref} style={{ position: 'relative' }}>
        <button
          type="button"
          className="flex items-center justify-center shrink-0 rounded-md cursor-pointer border-0"
          style={{
            width: '24px',
            height: '24px',
            backgroundColor: open ? 'rgba(0,0,0,0.75)' : '#00000080',
            transition: 'background-color 0.12s',
          }}
          onMouseEnter={(e) => { if (!open) e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.65)'; }}
          onMouseLeave={(e) => { if (!open) e.currentTarget.style.backgroundColor = '#00000080'; }}
          onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
            <path d="M8 5C8.552 5 9 4.552 9 4C9 3.448 8.552 3 8 3C7.448 3 7 3.448 7 4C7 4.552 7.448 5 8 5Z" fill="#FFFFFF" />
            <path d="M8 9C8.552 9 9 8.552 9 8C9 7.448 8.552 7 8 7C7.448 7 7 7.448 7 8C7 8.552 7.448 9 8 9Z" fill="#FFFFFF" />
            <path d="M8 12.667C8.552 12.667 9 12.219 9 11.667C9 11.114 8.552 10.667 8 10.667C7.448 10.667 7 11.114 7 11.667C7 12.219 7.448 12.667 8 12.667Z" fill="#FFFFFF" />
          </svg>
        </button>

        {open && (
          <div
            className="absolute z-50 flex flex-col rounded-medium bg-select-bg border border-select-border"
            style={{
              top: 'calc(100% + 4px)',
              right: 0,
              minWidth: '100px',
              padding: '4px',
              boxShadow: '0px 4px 16px var(--color-select-shadow)',
            }}
          >
            {items.map((item, i) => (
              <div
                key={item.label}
                className="flex items-center gap-[4px] px-[12px] rounded-md shrink-0 cursor-pointer"
                style={{
                  height: '36px',
                  color: item.danger
                    ? (hovIdx === i ? '#F75F5F' : '#FF7A7A99')
                    : (hovIdx === i ? 'var(--color-select-item-text-hover)' : 'var(--color-select-item-text-normal)'),
                  backgroundColor: hovIdx === i ? 'var(--color-select-item-bg-hover)' : 'transparent',
                  transition: 'background-color 0.1s, color 0.1s',
                }}
                onMouseEnter={() => setHovIdx(i)}
                onMouseLeave={() => setHovIdx(null)}
                onClick={(e) => { e.stopPropagation(); item.action?.(); }}
              >
                {item.icon}
                <span
                  className="w-fit shrink-0 text-font-size-14 font-font-weight-regular"
                  style={{ fontFamily: FONT }}
                >
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {showConfirm && (
        <ConfirmDialog
          title="确定要删除吗？"
          description="删除后，该主体相关数据将被清除且不可恢复。"
          confirmText="删除"
          onCancel={() => setShowConfirm(false)}
          onConfirm={() => { setShowConfirm(false); onDelete?.(); }}
          zIndex={100}
        />
      )}
    </>
  );
}
