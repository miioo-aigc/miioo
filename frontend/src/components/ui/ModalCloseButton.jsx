/** 复用确认弹窗的无边框关闭按钮：24px 点击区域、16px 图标。 */
export default function ModalCloseButton({ onClick, disabled = false }) {
  return <button type="button" onClick={onClick} disabled={disabled} aria-label="关闭"
    className="flex h-[24px] w-[24px] shrink-0 items-center justify-center rounded-[6px] border-0 bg-transparent p-0 text-white disabled:cursor-not-allowed disabled:opacity-50">
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2.667 2.667L13.333 13.333M2.667 13.333L13.333 2.667" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  </button>;
}
