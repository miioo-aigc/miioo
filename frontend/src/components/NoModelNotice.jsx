const FONT = "'AlibabaPuHuiTi 2_55 Regular', 'Alibaba PuHuiTi 2.0', system-ui, sans-serif";
const FONT_MEDIUM = "'AlibabaPuHuiTi 2_65 Medium', 'Alibaba PuHuiTi 2.0', system-ui, sans-serif";

function AlertIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
      <path
        d="M10 18.333C12.302 18.333 14.385 17.4 15.893 15.892C17.401 14.384 18.334 12.301 18.334 10C18.334 7.699 17.401 5.615 15.893 4.107C14.385 2.599 12.302 1.667 10 1.667C7.699 1.667 5.616 2.599 4.108 4.107C2.6 5.615 1.667 7.699 1.667 10C1.667 12.301 2.6 14.384 4.108 15.892C5.616 17.4 7.699 18.333 10 18.333Z"
        fill="#EB8B14"
        stroke="#EB8B14"
        strokeLinejoin="round"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M10 15.417C10.575 15.417 11.041 14.95 11.041 14.375C11.041 13.8 10.575 13.334 10 13.334C9.424 13.334 8.958 13.8 8.958 14.375C8.958 14.95 9.424 15.417 10 15.417Z"
        fill="#FFFFFF"
      />
      <path d="M10 5V11.667" fill="none" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function NoModelNotice({ onConfigureAPI, onViewTutorial, onClose }) {
  return (
    <div
      className="fixed top-[24px] right-[24px] z-[100] flex w-[400px] flex-col rounded-2xl overflow-clip backdrop-blur-[20px]"
      style={{ backgroundColor: '#EB8B141A', border: '1px solid #EB8B14' }}
    >
      {/* 头部 */}
      <div className="flex items-center justify-between gap-[16px] px-[24px] py-[16px]">
        <div className="flex items-center gap-[8px]">
          <AlertIcon />
          <div className="text-base/[20px] font-medium" style={{ fontFamily: FONT_MEDIUM, color: '#F7A33B' }}>
            提醒
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex shrink-0 items-center justify-center transition-opacity hover:opacity-60 active:opacity-40"
          aria-label="关闭"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
            <path d="M2.667 2.667L13.333 13.333" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M2.667 13.333L13.333 2.667" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* 内容 */}
      <div className="px-[24px] pb-[24px] pt-[8px]">
        <div className="text-base/[20px]" style={{ fontFamily: FONT, color: '#F7A33B' }}>
          无可用模型，请检查API配置。
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="flex items-center justify-end gap-[12px] px-[24px] pb-[16px]">
        <button
          type="button"
          onClick={onViewTutorial}
          className="flex shrink-0 items-center self-stretch justify-center gap-[4px] rounded-lg px-[16px] transition-colors hover:brightness-110 active:brightness-90 [box-shadow:#00000066_3px_3px_8px] [outline:1px_solid_#00000080]"
          style={{ backgroundColor: '#161616', border: '1px solid #FFFFFF0D' }}
        >
          <div className="inline-block w-max shrink-0 text-sm/[18px] text-white" style={{ fontFamily: FONT }}>
            查看教程
          </div>
        </button>

        <button
          type="button"
          onClick={onConfigureAPI}
          className="flex h-[36px] shrink-0 items-center justify-center gap-[4px] rounded-lg px-[16px] transition-colors hover:brightness-110 active:brightness-90 [outline:1px_solid_#00000080]"
          style={{ backgroundColor: '#EB8B14', border: '1px solid #FFFFFF33' }}
        >
          <div className="inline-block w-max shrink-0 text-center text-sm/[18px] font-medium" style={{ fontFamily: FONT_MEDIUM, color: '#090909' }}>
            配置API
          </div>
        </button>
      </div>
    </div>
  );
}
