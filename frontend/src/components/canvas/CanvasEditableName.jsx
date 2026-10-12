import { useEffect, useRef, useState } from 'react';
import './CanvasEditableName.css';

export default function CanvasEditableName({ name, onRename, onStart, className = '' }) {
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
  return <span className={`canvas-editable-name nodrag nopan nowheel ${className}`}
    onPointerDown={(event) => event.stopPropagation()}
    onClick={(event) => event.stopPropagation()}
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
