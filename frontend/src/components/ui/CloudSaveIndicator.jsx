import { CloudUpload } from 'lucide-react';
import Tooltip from './Tooltip';
import './CloudSaveIndicator.css';

export default function CloudSaveIndicator({ status = 'idle', label, onClick, disabled, style }) {
  const Element = onClick ? 'button' : 'span';
  return <Tooltip label={label} placement="bottom" offset={8}>
    <Element className="cloud-save-indicator" style={style} data-status={status} aria-label={label}
      role={onClick ? undefined : 'status'} type={onClick ? 'button' : undefined}
      onClick={onClick} disabled={onClick ? disabled || status === 'saving' : undefined} aria-busy={status === 'saving' || undefined}>
      <CloudUpload size={16} strokeWidth={1.7} aria-hidden="true" />
      {status === 'saving' && <CloudUpload className="cloud-save-indicator__progress" size={16} strokeWidth={1.7} aria-hidden="true" />}
    </Element>
  </Tooltip>;
}
