/**
 * 首页底部 API 配置入口的提示气泡。
 * 只负责展示，不读取登录状态或配置请求；显示条件由 Home 通过菜单配置决定。
 */
export default function ApiConfigBubble() {
  return (
    <div
      style={{
        position: 'absolute',
        left: '35.5px',
        top: '50%',
        translate: '0 -50%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 0,
        padding: '8px 16px',
        borderRadius: '8px',
        backgroundColor: '#FFFFFF',
        pointerEvents: 'none',
        zIndex: 50,
        whiteSpace: 'nowrap',
        animation: 'api-bubble-nudge 2.4s cubic-bezier(0.36, 0.07, 0.19, 0.97) 1.2s infinite',
      }}
    >
      <div className="w-fit font-['AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif] text-[#090909] text-sm/4.5">
        点击此处配置API
      </div>
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{
          position: 'absolute',
          left: 7,
          top: '50%',
          rotate: '90deg',
          translate: '0 -50%',
          transformOrigin: '0% 0%',
        }}
      >
        <path d="M12 6.333L8 10.333L4 6.333H12Z" fill="#FFFFFF" stroke="#FFFFFF" strokeWidth="1.333" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
