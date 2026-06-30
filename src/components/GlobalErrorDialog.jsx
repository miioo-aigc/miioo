import { createPortal } from 'react-dom';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif";
const FONT_MEDIUM = "'AlibabaPuHuiTi_2_65_Medium','Alibaba PuHuiTi 2.0',system-ui,sans-serif";

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <path d="M2.667 2.667L13.333 13.333" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2.667 13.333L13.333 2.667" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function GlobalErrorDialog({
  title = '操作失败',
  message,
  detail = '',
  onClose,
}) {
  if (!message) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-surface-overlay px-[24px] backdrop-blur-[20px]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[480px] rounded-medium border border-stroke-normal bg-neutral-200 shadow-[0px_24px_80px_rgba(0,0,0,0.45)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-[16px] px-[24px] py-[20px]">
          <div className="flex-1">
            <div className="text-[18px] leading-[22px] text-text-primary" style={{ fontFamily: FONT_MEDIUM }}>
              {title}
            </div>
            <div className="mt-[10px] text-font-size-14 leading-[24px] text-text-secondary" style={{ fontFamily: FONT }}>
              {message}
            </div>
            {detail ? (
              <div className="mt-[10px] rounded-medium border border-white-10 bg-neutral-300 px-[12px] py-[10px] text-font-size-12 leading-[20px] text-text-hint" style={{ fontFamily: FONT }}>
                {detail}
              </div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭错误提示"
            className="flex h-[28px] w-[28px] items-center justify-center rounded-[8px] bg-white-5 transition-opacity hover:opacity-80 active:opacity-60"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="flex justify-end px-[24px] pb-[20px]">
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 items-center justify-center rounded-lg border border-btn-primary-border bg-btn-primary-bg-normal px-[16px] text-sm/[18px] text-text-primary outline outline-1 outline-stroke-outline [box-shadow:3px_3px_8px_var(--color-black-40)] transition-colors hover:bg-btn-primary-bg-hover active:bg-btn-primary-bg-active"
            style={{ fontFamily: FONT_MEDIUM }}
          >
            我知道了
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
