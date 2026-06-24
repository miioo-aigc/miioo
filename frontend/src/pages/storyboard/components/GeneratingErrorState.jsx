const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif";

/** 智能分镜失败时的错误态，含重新提取 + 手动添加按钮 */
export default function GeneratingErrorState({ onRetry, onAddManual }) {
  return (
    <div style={{
      position: 'absolute', inset: 0, marginBottom: '24px', marginRight: '32px',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: '24px',
      backgroundColor: '#161616', borderRadius: '16px',
      border: '1px solid rgba(255,255,255,0.08)',
    }}>
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" style={{ flexShrink: 0 }}>
        <circle cx="16" cy="16" r="15" stroke="#FFFFFF66" strokeWidth="1.5" />
        <circle cx="10" cy="13" r="2" fill="#FFFFFF66" />
        <circle cx="22" cy="13" r="2" fill="#FFFFFF66" />
        <path d="M10 23 Q16 19 22 23" stroke="#FFFFFF66" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <span style={{ fontFamily: FONT, fontSize: '14px', color: '#FFFFFF99' }}>
        糟糕，智能分镜失败了，待会儿再试试吧！
      </span>
      <button
        type="button"
        onClick={onRetry}
        className="[font-synthesis:none] flex items-center justify-center px-[16px] h-9 rounded-lg bg-btn-accent-bg-normal hover:bg-btn-accent-bg-hover active:bg-btn-accent-bg-active border border-btn-accent-border [outline:1px_solid_var(--color-stroke-outline)] shrink-0 cursor-pointer"
        style={{ backgroundImage: 'linear-gradient(157.78deg, #7AE5B94D 2.88%, #7AE5B900 56.77%)' }}
      >
        <span className="text-btn-accent-text text-[14px] font-medium leading-[18px]" style={{ fontFamily: FONT }}>
          重新提取分镜
        </span>
      </button>
      <button
        type="button"
        onClick={onAddManual}
        className="[font-synthesis:none] flex items-center justify-center px-[16px] h-9 rounded-lg bg-btn-primary-bg-normal hover:bg-btn-primary-bg-hover active:bg-btn-primary-bg-active border border-btn-primary-border [outline:1px_solid_var(--color-stroke-outline)] [box-shadow:var(--color-shadow)_3px_3px_8px] shrink-0 cursor-pointer"
      >
        <span className="text-btn-primary-text text-[14px] font-normal leading-[18px]" style={{ fontFamily: FONT }}>
          手动添加分镜
        </span>
      </button>
    </div>
  );
}
