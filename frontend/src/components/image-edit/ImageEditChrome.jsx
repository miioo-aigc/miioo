import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import Button from '../ui/Button';
import { useModalSize } from '../../utils/useModalSize';
import './ImageEdit.css';

export function ImageEditHeader({ title, onClose, busy }) {
  return <header className="image-edit-header"><span>{title}</span><button type="button" aria-label="关闭" title="关闭" disabled={busy} onClick={onClose}><X size={16} /></button></header>;
}

export function ImageEditFooter({ onReset, onClose, onSubmit, busy, disabled, label = '保存' }) {
  return <footer className="image-edit-footer">
    <Button variant="link" size="large" className="image-edit-reset" contentClassName="image-edit-reset-content" icon={<svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M2 7C2 4.24 4.24 2 7 2C8.66 2 10.13 2.81 11.06 4.06" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M12 7C12 9.76 9.76 12 7 12C5.34 12 3.87 11.19 2.94 9.94" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M11 2L11.06 4.06L9 4M3 12L2.94 9.94L5 10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>} disabled={busy} onClick={onReset}>重置</Button>
    <Button variant="secondary" size="large" disabled={busy} onClick={onClose}>取消</Button>
    <Button variant="primary" size="large" loading={busy} disabled={disabled || busy} onClick={onSubmit}>{label}</Button>
  </footer>;
}

export default function ImageEditChrome({ title, children, onClose, busy, footer, baseWidth = 1200, baseHeight = 800 }) {
  const { width, height, scale } = useModalSize(baseWidth, baseHeight);
  const headerHeight = 60;
  const footerHeight = 72;
  const scaledAreaHeight = height - headerHeight - footerHeight;
  const displayHeight = headerHeight + scaledAreaHeight * scale + footerHeight;
  const root = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    root.current?.focus();
    return () => previous?.focus?.();
  }, []);
  const handleKey = (event) => {
    if (event.key === 'Escape' && !busy) onClose();
    if (event.key !== 'Tab') return;
    const elements = [...root.current.querySelectorAll('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),[tabindex="0"]')];
    const first = elements[0];
    const last = elements.at(-1);
    if (event.shiftKey && (document.activeElement === first || document.activeElement === root.current)) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  };
  return createPortal(<div className="image-edit-overlay" onClick={() => !busy && onClose()}>
    <section ref={root} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} className="image-edit-shell" style={{ width: `${width * scale}px`, height: `${displayHeight}px` }} onKeyDown={handleKey} onClick={(event) => event.stopPropagation()}>
      <div className="image-edit-fixed-header" style={{ width: `${width * scale}px`, height: `${headerHeight}px` }}>
        <ImageEditHeader title={title} onClose={onClose} busy={busy} />
      </div>
      <div className="image-edit-scaled-slot" style={{ width: `${width * scale}px`, height: `${scaledAreaHeight * scale}px` }}>
        <div className="image-edit-scaled-area" style={{ width: `${width}px`, height: `${scaledAreaHeight}px`, transform: `scale(${scale})` }}>{children}</div>
      </div>
      {footer}
    </section>
  </div>, document.body);
}
