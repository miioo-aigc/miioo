import './Slider.css';

export default function Slider({ min = 0, max = 100, value, className = '', ...props }) {
  const percent = max > min ? Math.max(0, Math.min(100, (value - min) / (max - min) * 100)) : 0;
  return <input {...props} className={`shared-slider ${className}`} type="range" min={min} max={max} value={value}
    style={{ background: `linear-gradient(to right,var(--color-brand-main) ${percent}%,var(--color-stroke-accent) 0)` }} />;
}
