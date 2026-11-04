// 顶栏名称单击编辑，异步失败保留编辑态。
import { useEffect, useRef, useState } from 'react';
export default function CanvasHeaderName({ name, label, onRename, onStart, disabled, maxLength, normalize, validate }) {
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(name);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);
  const savingRef = useRef(false);
  const finishedRef = useRef(false);
  const composingRef = useRef(false);
  const originalName = name;

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const startEditing = () => {
    if (savingRef.current) return;
    finishedRef.current = false;
    onStart?.();
    setDraftName(originalName);
    setError('');
    setEditing(true);
  };

  const cancelEditing = () => {
    if (savingRef.current) return;
    finishedRef.current = true;
    setDraftName(originalName);
    setError('');
    setEditing(false);
  };

  const saveName = async () => {
    if (finishedRef.current || savingRef.current || composingRef.current) return;
    const nextName = draftName.trim();
    const validationError = validate(nextName);
    if (validationError) {
      setError(validationError);
      inputRef.current?.focus();
      return;
    }
    if (nextName === originalName) {
      finishedRef.current = true;
      setEditing(false);
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setError('');
    try {
      if (await onRename(nextName) === false) { setError('保存失败，请重试'); return; }
      finishedRef.current = true;
      setDraftName(nextName);
      setEditing(false);
    } catch (renameError) {
      setDraftName(originalName);
      setError(renameError?.message || '保存' + label + '失败，请重试');
      inputRef.current?.focus();
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const handleChange = (event) => {
    setDraftName(composingRef.current ? event.target.value : normalize(event.target.value));
    if (error) setError('');
  };

  return <div onKeyDown={(event) => event.stopPropagation()}>
        {editing ? (
          <div className="relative flex flex-col items-start">
            <div className="flex items-center gap-[6px]">
              <input
                ref={inputRef}
                value={draftName}
                maxLength={maxLength}
                readOnly={saving || disabled}
                onChange={handleChange}
                onCompositionStart={() => { composingRef.current = true; }}
                onCompositionEnd={(event) => {
                  composingRef.current = false;
                  setDraftName(normalize(event.currentTarget.value));
                }}
                onBlur={saveName}
                onKeyDown={(event) => {
                  if (composingRef.current || event.nativeEvent.isComposing || event.keyCode === 229) return;
                  if (event.key === 'Enter') { event.preventDefault(); saveName(); }
                  if (event.key === 'Escape') { event.preventDefault(); cancelEditing(); }
                }}
                aria-label={label}
                aria-busy={saving}
                className="h-[22px] w-[220px] border-0 border-b border-stroke-accent bg-transparent p-0 text-[14px] leading-[18px] text-text-primary outline-none"
              />
              {saving && <span className="text-[12px] text-text-hint">保存中</span>}
            </div>
            {error && <span role="alert" className="absolute top-[26px] whitespace-nowrap text-[12px] text-text-danger">{error}</span>}
          </div>
        ) : (
          <button type="button" onClick={onRename ? startEditing : undefined} title={'编辑' + label} disabled={disabled || !onRename} className={`flex items-center border-0 bg-transparent p-0 text-left ${onRename ? 'cursor-pointer' : 'cursor-default'}`}>
            <span className="max-w-[220px] truncate text-[14px] leading-[18px] text-text-primary">{originalName}</span>
          </button>
        )}
  </div>;
}
