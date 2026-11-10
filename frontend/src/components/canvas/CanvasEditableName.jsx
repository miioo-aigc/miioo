import { useEffect, useRef, useState } from 'react';
import './CanvasEditableName.css';

// selectOnClick 打开时，非编辑态的单击继续冒泡，交给 React Flow 节点层完成选中。
export default function CanvasEditableName({ name, onRename, onStart, className = '', selectOnClick = false }) {
  const [editing, setEditing] = useState(false);
  const inputRef = useRef(null);
  const composingRef = useRef(false);
  const finishedRef = useRef(false);
  useEffect(() => {
    if (!editing) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [editing]);
  const finish = (save) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    const next = inputRef.current?.value.trim();
    if (save && next && next !== name) onRename?.(next);
    setEditing(false);
  };
  return <span className={`canvas-editable-name ${editing ? 'nodrag nopan nowheel' : ''} ${className}`}
    onPointerDown={(event) => { if (editing) event.stopPropagation(); }}
    onClick={(event) => { if (editing || !selectOnClick) event.stopPropagation(); }}
    onDoubleClick={(event) => {
      event.stopPropagation();
      if (editing || !onRename) return;
      onStart?.();
      finishedRef.current = false;
      composingRef.current = false;
      setEditing(true);
    }}>
    {editing ? <input ref={inputRef} aria-label="重命名" defaultValue={name}
      onBlur={() => finish(true)}
      onCompositionStart={() => { composingRef.current = true; }}
      onCompositionEnd={() => { composingRef.current = false; }}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (composingRef.current || event.nativeEvent.isComposing || event.keyCode === 229) return;
        if (event.key === 'Enter' || event.key === 'Escape') {
          event.preventDefault();
          finish(event.key === 'Enter');
        }
      }} onKeyUp={(event) => event.stopPropagation()} /> : <span title={name}>{name}</span>}
  </span>;
}
