import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { FONT } from '../utils/fonts';
import { parseSegments, serializeEditor, rebuildEditorDOM, getCaretOffset, setCaretOffset } from '../utils/storyboardEditor';
import SubjectTag from './SubjectTag';
import ReferenceMentionDropdown from './ReferenceMentionDropdown';

const MAX_PROMPT_LEN = 1000;

const PanelPromptInput = forwardRef(function PanelPromptInput({ value, onChange, referenceItems = [] }, ref) {
  const [focused, setFocused] = useState(false);
  const [hov, setHov] = useState(false);
  const [mentionQuery, setMentionQuery] = useState(null);
  const editorRef = useRef(null);
  const wrapRef = useRef(null);
  const composingRef = useRef(false);
  const suppressSyncRef = useRef(false);
  const allSubjectsRef = useRef([]);
  const typeOverridesRef = useRef({});
  const isBlurringRef = useRef(false);
  const pendingMentionRef = useRef(null);

  useImperativeHandle(ref, () => ({
    insertMention(name, type) {
      const el = editorRef.current;
      if (el) {
        doInsertMention(el, name, type);
      } else {
        pendingMentionRef.current = { name, type };
        setFocused(true);
      }
    },
  }));

  function doInsertMention(el, name, type) {
    const caretOffset = getCaretOffset(el);
    const currentVal = serializeEditor(el);
    const before = currentVal.slice(0, caretOffset);
    const after = currentVal.slice(caretOffset);
    const newVal = `${before}@${name} ${after}`.slice(0, MAX_PROMPT_LEN);
    const newCaretOffset = caretOffset + name.length + 2;
    const typeOverrides = { ...typeOverridesRef.current, [name]: type };
    typeOverridesRef.current = typeOverrides;
    onChange(newVal);
    suppressSyncRef.current = true;
    requestAnimationFrame(() => {
      if (!editorRef.current) return;
      suppressSyncRef.current = false;
      rebuildEditorDOM(editorRef.current, newVal, allSubjectsRef.current, typeOverrides);
      setCaretOffset(editorRef.current, newCaretOffset);
      editorRef.current.focus();
    });
  }

  const borderColor = focused ? 'rgba(45,195,225,0.60)' : hov ? 'rgba(255,255,255,0.20)' : 'rgba(255,255,255,0.08)';
  const outlineColor = focused ? 'rgba(45,195,225,0.12)' : '#00000080';
  const outlineWidth = focused ? '3px' : '1px';

  const allSubjects = referenceItems;
  allSubjectsRef.current = allSubjects;

  function readDOMTypes(el) {
    const map = {};
    for (const node of el.childNodes) {
      if (node.dataset?.mention && node.dataset?.mentionType) {
        map[node.dataset.mention] = node.dataset.mentionType;
      }
    }
    return map;
  }

  function syncToValue(el) {
    if (suppressSyncRef.current || isBlurringRef.current) {
      suppressSyncRef.current = false;
      return;
    }
    const caretOffset = getCaretOffset(el);
    const domTypes = readDOMTypes(el);
    typeOverridesRef.current = { ...typeOverridesRef.current, ...domTypes };
    const raw = serializeEditor(el);
    const clamped = raw.slice(0, MAX_PROMPT_LEN);
    onChange(clamped);
    rebuildEditorDOM(el, clamped, allSubjects, typeOverridesRef.current);
    setCaretOffset(el, caretOffset);
    const textBefore = clamped.slice(0, caretOffset);
    const atIdx = textBefore.lastIndexOf('@');
    if (atIdx !== -1) {
      const fragment = textBefore.slice(atIdx + 1);
      if (!fragment.includes(' ') && !fragment.includes('\n')) {
        setMentionQuery(fragment);
        return;
      }
    }
    setMentionQuery(null);
  }

  useEffect(() => {
    if (focused && editorRef.current) {
      const el = editorRef.current;
      el.focus();
      rebuildEditorDOM(el, value, allSubjects, typeOverridesRef.current);
      if (pendingMentionRef.current) {
        const { name, type } = pendingMentionRef.current;
        pendingMentionRef.current = null;
        setCaretOffset(el, value.length);
        doInsertMention(el, name, type);
      } else {
        setCaretOffset(el, value.length);
      }
    }
  }, [focused]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!focused) return;
    const el = editorRef.current;
    if (!el) return;
    function nativeBeforeInput(e) {
      if (composingRef.current) return;
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      for (const node of el.childNodes) {
        if (!node.dataset?.mention) continue;
        const nodeRange = document.createRange();
        nodeRange.selectNode(node);
        if (
          range.compareBoundaryPoints(Range.START_TO_END, nodeRange) > 0 &&
          range.compareBoundaryPoints(Range.END_TO_START, nodeRange) < 0
        ) {
          e.preventDefault();
          return;
        }
      }
    }
    el.addEventListener('beforeinput', nativeBeforeInput);
    return () => el.removeEventListener('beforeinput', nativeBeforeInput);
  }, [focused]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleKeyDown(e) {
    if (e.key === 'Escape') { setMentionQuery(null); return; }
    const el = editorRef.current;
    if (!el) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);

    if (e.key === 'Backspace' || e.key === 'Delete') {
      for (const node of el.childNodes) {
        if (!node.dataset?.mention) continue;
        const nodeRange = document.createRange();
        nodeRange.selectNode(node);
        const collapsed = range.collapsed;

        if (collapsed && e.key === 'Backspace') {
          const afterRange = document.createRange();
          afterRange.setStartAfter(node);
          afterRange.collapse(true);
          if (range.compareBoundaryPoints(Range.START_TO_START, afterRange) === 0) {
            e.preventDefault();
            const caretOffset = getCaretOffset(el) - (node.dataset.mention.length + 1);
            node.remove();
            const raw = serializeEditor(el);
            onChange(raw.slice(0, MAX_PROMPT_LEN));
            rebuildEditorDOM(el, raw.slice(0, MAX_PROMPT_LEN), allSubjects);
            setCaretOffset(el, Math.max(0, caretOffset));
            setMentionQuery(null);
            return;
          }
        }
        if (collapsed && e.key === 'Delete') {
          const beforeRange = document.createRange();
          beforeRange.setStartBefore(node);
          beforeRange.collapse(true);
          if (range.compareBoundaryPoints(Range.START_TO_START, beforeRange) === 0) {
            e.preventDefault();
            const caretOffset = getCaretOffset(el);
            node.remove();
            const raw = serializeEditor(el);
            onChange(raw.slice(0, MAX_PROMPT_LEN));
            rebuildEditorDOM(el, raw.slice(0, MAX_PROMPT_LEN), allSubjects);
            setCaretOffset(el, caretOffset);
            setMentionQuery(null);
            return;
          }
        }
        if (!collapsed) {
          const inside =
            range.compareBoundaryPoints(Range.START_TO_END, nodeRange) > 0 &&
            range.compareBoundaryPoints(Range.END_TO_START, nodeRange) < 0;
          if (inside) {
            e.preventDefault();
            const caretOffset = getCaretOffset(el);
            range.deleteContents();
            const raw = serializeEditor(el);
            onChange(raw.slice(0, MAX_PROMPT_LEN));
            rebuildEditorDOM(el, raw.slice(0, MAX_PROMPT_LEN), allSubjects);
            setCaretOffset(el, Math.max(0, caretOffset));
            setMentionQuery(null);
            return;
          }
        }
      }
    }

    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      for (const node of el.childNodes) {
        if (!node.dataset?.mention) continue;
        if (e.key === 'ArrowLeft') {
          const afterRange = document.createRange();
          afterRange.setStartAfter(node);
          afterRange.collapse(true);
          if (range.collapsed && range.compareBoundaryPoints(Range.START_TO_START, afterRange) === 0) {
            e.preventDefault();
            const r = document.createRange();
            r.setStartBefore(node);
            r.collapse(true);
            sel.removeAllRanges();
            sel.addRange(r);
            return;
          }
        } else {
          const beforeRange = document.createRange();
          beforeRange.setStartBefore(node);
          beforeRange.collapse(true);
          if (range.collapsed && range.compareBoundaryPoints(Range.START_TO_START, beforeRange) === 0) {
            e.preventDefault();
            const r = document.createRange();
            r.setStartAfter(node);
            r.collapse(true);
            sel.removeAllRanges();
            sel.addRange(r);
            return;
          }
        }
      }
    }
  }

  function handleInput() {
    if (composingRef.current || !focused) return;
    const el = editorRef.current;
    if (el) syncToValue(el);
  }

  function handlePaste(e) {
    e.preventDefault();
    const text = e.clipboardData?.getData('text/plain') ?? '';
    if (text) {
      document.execCommand('insertText', false, text);
    }
  }

  function handleCompositionStart() { composingRef.current = true; }
  function handleCompositionEnd() {
    composingRef.current = false;
    const el = editorRef.current;
    if (el && focused) syncToValue(el);
  }

  function handleBlur() {
    isBlurringRef.current = true;
    setFocused(false);
    setMentionQuery(null);
    requestAnimationFrame(() => {
      isBlurringRef.current = false;
    });
  }

  function handleSelectMention(name, type) {
    const el = editorRef.current;
    if (!el) return;
    const caretOffset = getCaretOffset(el);
    const textBefore = value.slice(0, caretOffset);
    const atIdx = textBefore.lastIndexOf('@');
    const before = value.slice(0, atIdx);
    const after = value.slice(caretOffset);

    const newVal = `${before}@${name} ${after}`.slice(0, MAX_PROMPT_LEN);
    const newCaretOffset = atIdx + name.length + 2;
    const typeOverrides = { ...readDOMTypes(el), [name]: type };

    onChange(newVal);
    setMentionQuery(null);
    suppressSyncRef.current = true;
    requestAnimationFrame(() => {
      if (!editorRef.current) return;
      suppressSyncRef.current = false;
      rebuildEditorDOM(editorRef.current, newVal, allSubjectsRef.current, typeOverrides);
      setCaretOffset(editorRef.current, newCaretOffset);
    });
  }

  const segments = parseSegments(value, allSubjects);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignSelf: 'stretch' }}>
      <span style={{ fontSize: '14px', lineHeight: '18px', color: 'rgba(255,255,255,0.60)', fontFamily: FONT }}>提示词</span>
      <div
        ref={wrapRef}
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        style={{
          display: 'flex', flexDirection: 'column',
          backgroundColor: '#1D1E1E', borderRadius: '8px',
          border: `1px solid ${borderColor}`, outline: `${outlineWidth} solid ${outlineColor}`,
          padding: '9px 12px', minHeight: '120px', boxSizing: 'border-box',
          transition: 'border-color 0.10s',
          position: 'relative',
        }}
      >
        {focused ? (
          <div
            key="editor"
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onFocus={() => setFocused(true)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            onInput={handleInput}
            onPaste={handlePaste}
            onCompositionStart={handleCompositionStart}
            onCompositionEnd={handleCompositionEnd}
            data-placeholder="描述画面内容、风格、镜头… 输入 @ 引入角色/场景/道具"
            style={{
              flex: 1, outline: 'none', background: 'transparent',
              fontSize: '14px', lineHeight: '21px', color: '#FFFFFF', caretColor: '#2DC3E1',
              fontFamily: FONT, wordBreak: 'break-all', whiteSpace: 'pre-wrap',
              overflowY: 'auto', boxSizing: 'border-box',
            }}
          />
        ) : (
          <div
            key="display"
            onClick={() => setFocused(true)}
            style={{
              flex: 1, overflow: 'hidden',
              fontSize: '14px', lineHeight: '21px', fontFamily: FONT,
              wordBreak: 'break-all', whiteSpace: 'pre-wrap',
              cursor: 'text',
              color: value ? '#FFFFFF' : 'rgba(255,255,255,0.30)',
            }}
          >
            {value === '' ? '描述画面内容、风格、镜头… 输入 @ 引入角色/场景/道具' : segments.map((seg, i) =>
              seg.kind === 'mention'
                ? <SubjectTag key={i} name={seg.name} type={seg.type} />
                : <span key={i}>{seg.text}</span>
            )}
          </div>
        )}
        <div style={{ alignSelf: 'stretch', textAlign: 'right', fontSize: '12px', lineHeight: '18px', color: 'rgba(255,255,255,0.40)', fontFamily: FONT, flexShrink: 0 }}>
          {value.length}/{MAX_PROMPT_LEN}
        </div>
      </div>
      {mentionQuery !== null && (
        <ReferenceMentionDropdown
          referenceItems={allSubjects}
          query={mentionQuery}
          onSelect={handleSelectMention}
          onClose={() => setMentionQuery(null)}
          triggerRef={wrapRef}
        />
      )}
    </div>
  );
});

export default PanelPromptInput;
