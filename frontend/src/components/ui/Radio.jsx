/** 设计系统单选框：原生键盘行为，16px 圆形选框。 */
export default function Radio({ checked = false, disabled = false, onChange, name, value, 'aria-label': ariaLabel }) {
  return <span className="relative inline-flex h-[16px] w-[16px] shrink-0">
    <input type="radio" checked={checked} disabled={disabled} onChange={onChange} name={name} value={value} aria-label={ariaLabel}
      className="peer m-0 h-[16px] w-[16px] cursor-pointer appearance-none rounded-full border border-checkbox-border-normal bg-checkbox-bg-normal outline outline-1 outline-stroke-outline checked:border-checkbox-border-active checked:bg-checkbox-bg-active focus-visible:ring-2 focus-visible:ring-brand-main disabled:cursor-not-allowed disabled:border-checkbox-border-disabled disabled:bg-checkbox-bg-disabled disabled:checked:bg-checkbox-bg-disabled-active" />
    <span className="pointer-events-none absolute left-[5px] top-[5px] hidden h-[6px] w-[6px] rounded-full bg-[#0A0A0A] peer-checked:block" />
  </span>;
}
