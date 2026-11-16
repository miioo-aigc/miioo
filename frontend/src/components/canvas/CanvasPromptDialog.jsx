/** 画布提示词展开容器；保留节点业务上下文，隔离画布事件。 */
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Minimize2 } from 'lucide-react';
import { IconButton } from '../ui';
import './CanvasPromptDialog.css';

export default function CanvasPromptDialog({ children, onClose }) {
  const dialog = useRef(null);
  const scrollTimer = useRef(null);
  useEffect(() => () => clearTimeout(scrollTimer.current), []);
  const showScrollbar = (event) => {
    const editor = event.target;
    if (!editor.matches?.('.composer-surface__editor')) return;
    editor.dataset.scrolling = 'true';
    clearTimeout(scrollTimer.current);
    scrollTimer.current = setTimeout(() => { delete editor.dataset.scrolling; }, 1000);
  };
  useEffect(() => {
    const previous = document.activeElement;
    const frame = requestAnimationFrame(() => {
      const editor = dialog.current?.querySelector('[contenteditable="true"]');
      if (!editor) return;
      editor.focus();
      const range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      editor.scrollTop = editor.scrollHeight;
    });
    return () => { cancelAnimationFrame(frame); if (previous?.isConnected) previous.focus(); };
  }, []);
  const trapFocus = (event) => {
    if (event.key !== 'Tab') return;
    const controls = [...dialog.current.querySelectorAll('button:not(:disabled), input, textarea, [contenteditable="true"], [tabindex="0"]')]
      .filter((element) => element.getClientRects().length && !element.closest('[inert]'));
    const first = controls[0];
    const last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  };
  return createPortal(<div className="canvas-prompt-dialog-overlay nodrag nopan nowheel"
    onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}
    onWheel={(event) => event.stopPropagation()} onKeyDownCapture={trapFocus}
    onKeyDown={(event) => {
      event.stopPropagation();
      if (event.key === 'Escape' && !event.defaultPrevented && !event.nativeEvent.isComposing) {
        event.preventDefault(); onClose();
      }
    }}>
    <section ref={dialog} role="dialog" aria-modal="true" aria-label="编辑提示词" className="canvas-prompt-dialog" onScrollCapture={showScrollbar}>
      <IconButton aria-label="缩小编辑框" variant="link" className="canvas-creation-panel__expand-button canvas-prompt-dialog__collapse" onClick={onClose}>
        <Minimize2 size={18} strokeWidth={1.5} />
      </IconButton>
      {children}
    </section>
  </div>, document.body);
}
