import Button from '../ui/Button';

export function QualityOption({ value, selected, onClick }) {
  return <Button variant="secondary" size="large" className="upscale-quality-option" aria-pressed={selected} onClick={() => onClick(value)}>{value}</Button>;
}

export function UpscaleFooter({ onClose, onSubmit, disabled, label = 'AI生成', closeLabel = '取消', busy = false }) {
  return <footer className="upscale-footer">
    <Button variant="secondary" size="large" disabled={busy} onClick={onClose}>{closeLabel}</Button>
    <Button variant="primary" size="large" loading={busy} disabled={disabled || busy} onClick={onSubmit}>{label}</Button>
  </footer>;
}
