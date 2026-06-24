import { useState, useRef, useEffect, memo } from 'react';
import { FONT } from '../utils/fonts';

function EditableText({ value, onChange, placeholder = '点击编辑…', style = {} }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || '');
  const inputRef = useRef(null);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);
  useEffect(() => { setDraft(value || ''); }, [value]);
  if (editing) {
    return (
      <input ref={inputRef} value={draft} onChange={(e) => setDraft(e.target.value)}
        onBlur={() => { setEditing(false); onChange?.(draft); }}
        onKeyDown={(e) => { if (e.key === 'Enter') { setEditing(false); onChange?.(draft); } if (e.key === 'Escape') { setEditing(false); setDraft(value || ''); } }}
        style={{ ...style, background: 'transparent', border: 'none', outline: 'none', width: '100%', fontFamily: FONT, color: '#FFFFFF' }} />
    );
  }
  return (
    <div onClick={() => setEditing(true)} style={{ ...style, cursor: 'pointer', fontFamily: FONT, color: value ? '#FFFFFF' : 'rgba(255,255,255,0.40)' }}>{value || placeholder}</div>
  );
}
export default memo(EditableText);
