export default function CreateCard({ label, onClick, disabled = false, busy = false }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled || busy} aria-busy={busy || undefined}
      className="flex aspect-[3/2] w-full min-w-0 flex-col items-center justify-center gap-[8px] rounded-[8px] border-[1.5px] border-dashed border-white/20 bg-[#1D1E1E] p-0 transition-[background] duration-150 enabled:cursor-pointer enabled:hover:bg-[#252626] disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-[2px] focus-visible:outline-brand-main">
      <span className="flex h-[32px] w-[32px] items-center justify-center rounded-full bg-white/[0.08]">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M10 4V16M4 10H16" stroke="#FFFFFF33" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </span>
      <span style={{ fontFamily: "'AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif", fontSize: '13px', fontWeight: 400, color: '#FFFFFF66' }}>{label}</span>
    </button>
  );
}
