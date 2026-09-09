import Button from '../ui/Button';

export function QualityOption({ value, selected, onClick }) {
  return <Button variant="secondary" size="large" className="upscale-quality-option" aria-pressed={selected} onClick={() => onClick(value)}>{value}</Button>;
}

export function UpscaleFooter({ onClose, onSubmit, disabled }) {
  return <footer className="upscale-footer">
    <Button variant="secondary" size="large" onClick={onClose}>取消</Button>
    <Button variant="primary" size="large" disabled={disabled} onClick={onSubmit}>AI生成</Button>
  </footer>;
}
