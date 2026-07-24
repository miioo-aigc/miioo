/**
 * Seedance 虚拟人像素材库的新建素材组入口。
 * 视觉尺寸与真人素材库卡片保持一致，业务创建流程由调用方接入。
 */
const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif";

function AddIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 102.4 102.4" aria-hidden="true">
      <path d="M50.035 10.618a41.697 41.697 90 1 0 41.698 41.697 41.744 41.744 0 0 0-41.698-41.697z m0 76.77a35.072 35.072 0 1 1 35.072-35.073 35.072 35.072 0 0 1-35.072 35.073z" fill="currentColor" />
      <path d="M66.163 55.388h-32.256a3.072 3.072 0 1 1 0-6.145h32.256a3.072 3.072 0 1 1 0 6.145z" fill="currentColor" />
      <path d="M50.035 71.515a3.072 3.072 0 0 1-3.072-3.072v-32.255a3.072 3.072 0 0 1 6.144 0v32.255a3.072 3.072 0 0 1-3.072 3.072z" fill="currentColor" />
    </svg>
  );
}

export default function AddVirtualGroupCard({ onClick }) {
  return (
    <button
      type="button"
      aria-label="新建素材组"
      onClick={onClick}
      className="aspect-[3/2] flex w-full min-w-[216px] max-w-[270px] items-center justify-self-center justify-center gap-[12px] rounded-[8px] border border-dashed border-white/20 bg-white/[0.08] p-[12px] text-white/80 antialiased transition-colors hover:border-white/30 hover:bg-white/[0.12] hover:text-white"
      style={{ fontFamily: FONT, fontSynthesis: 'none' }}
    >
      <span className="flex flex-1 items-center justify-center gap-[6px]">
        <AddIcon />
        <span className="w-max shrink-0 text-[14px] leading-[18px]">新建素材组</span>
      </span>
    </button>
  );
}
