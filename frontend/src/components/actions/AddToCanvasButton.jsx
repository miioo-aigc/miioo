import { AddToCanvasIcon } from '../ui';

export default function AddToCanvasButton({ onClick, disabled = false, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label="添加到画布"
      className={`inline-flex h-8 shrink-0 cursor-pointer items-center justify-center gap-[6px] rounded-[6px] border-0 bg-[#FFFFFF1A] px-3 text-xs leading-4 text-[#FFFFFFCC] transition-colors hover:bg-[#FFFFFF26] active:bg-[#FFFFFF26] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#FFFFFF66] ${className}`}
      style={{
        fontFamily: "'AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif",
        whiteSpace: 'nowrap',
      }}
    >
      <AddToCanvasIcon size={16} />
      <span>添加到画布</span>
    </button>
  );
}
