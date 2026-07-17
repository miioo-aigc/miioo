/**
 * @file PanelPromptInput.jsx
 * @structure-index
 *
 * ─── 提示词编辑器 ───────────────────────────────────────────────
 *   PanelPromptInput       contentEditable 提示词编辑、计数和展示态切换
 *   原子提及编辑           主体/参考素材提及插入、删除、光标和粘贴处理
 *   ReferenceMentionDropdown  @ 提及筛选、分类标签和资产选择
 *   SubjectTag             展示态提及标签
 *
 * ─── 依赖边界 ─────────────────────────────────────────────────────
 *   通过 value、referenceItems 和 onChange 接收页面/生成面板数据；
 *   不读取 StoryboardPage 的闭包变量，不调用 API、Store 或业务副作用。
 *   insertMention 仅通过 forwardRef 暴露给业务面板的参考素材快捷入口。
 *
 * ─── 更新记录 ─────────────────────────────────────────────────────
 *   2026-07-15  从 StoryboardPage 抽离提示词编辑、原子提及和提及下拉，保持原交互与回调签名
 */

import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { createPortal } from 'react-dom';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif";

// ─── 主体 @ 下拉（角色/场景/道具，用于提示词输入框）─────────────────────────────

const MENTION_TYPE_LABEL = {
  char: '角色', scene: '场景', prop: '道具', other: '其他',
  image: '参考图', video: '参考视频', audio: '参考音频',
};
const MENTION_TYPE_COLOR = {
  char: '#E2E24B', scene: '#4BE2C3', prop: '#4B9EE2', other: '#9E9E9E',
  image: '#E8A1FF', video: '#FF8A65', audio: '#66BB6A',
};

const MENTION_TABS = [
  { key: 'all', label: '全部' },
  { key: 'image', label: '参考图' },
  { key: 'char', label: '参考主体' },
  { key: 'video', label: '参考视频' },
  { key: 'audio', label: '参考音频' },
];

function ReferenceMentionDropdown({ referenceItems = [], query, onSelect, onClose, triggerRef }) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0, visibility: 'hidden' });
  const [selectedTab, setSelectedTab] = useState('all');

  const allItems = referenceItems.filter((item) => {
    return item.name && item.name.includes(query);
  });

  useEffect(() => {
    if (!triggerRef?.current || !ref.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const top = rect.bottom + 4;
    setPos((prev) => {
      const next = { top, left: rect.left, width: rect.width, visibility: 'visible' };
      if (prev.top === next.top && prev.left === next.left && prev.visibility === 'visible') return prev;
      return next;
    });
  }, [triggerRef]);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  const filteredItems = selectedTab === 'all'
    ? allItems
    : selectedTab === 'char'
      ? allItems.filter(item => ['char', 'scene', 'prop', 'other'].includes(item._type))
      : allItems.filter(item => item._type === selectedTab);

  // 只显示当前有匹配项的 tab
  const visibleTabs = MENTION_TABS.filter(tab => {
    if (tab.key === 'all') return true;
    if (tab.key === 'char') return allItems.some(item => ['char', 'scene', 'prop', 'other'].includes(item._type));
    return allItems.some(item => item._type === tab.key);
  });

  if (filteredItems.length === 0) return null;

  return createPortal(
    <div
      ref={ref}
      style={{
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        minWidth: Math.max(pos.width, 160),
        visibility: pos.visibility,
        zIndex: 9999,
        backgroundColor: '#1D1E1E',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '8px',
        padding: '4px',
        boxShadow: '0px 4px 16px rgba(0,0,0,0.40)',
        maxHeight: '240px',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ display: 'flex', gap: '2px', padding: '2px 4px 6px', flexShrink: 0 }}>
        {visibleTabs.map(tab => (
          <div
            key={tab.key}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setSelectedTab(tab.key)}
            style={{
              padding: '3px 8px', borderRadius: '4px', fontSize: '12px', lineHeight: '16px',
              cursor: 'pointer', fontFamily: '"Alibaba PuHuiTi 2.0", system-ui, sans-serif',
              color: selectedTab === tab.key ? '#FFFFFF' : 'rgba(255,255,255,0.50)',
              backgroundColor: selectedTab === tab.key ? 'rgba(255,255,255,0.08)' : 'transparent',
              transition: 'background-color 0.1s, color 0.1s',
            }}
            onMouseEnter={(e) => { if (selectedTab !== tab.key) e.currentTarget.style.color = 'rgba(255,255,255,0.80)'; }}
            onMouseLeave={(e) => { if (selectedTab !== tab.key) e.currentTarget.style.color = 'rgba(255,255,255,0.50)'; }}
          >
            {tab.label}
          </div>
        ))}
      </div>
      <div style={{ flex: 1, overflowY: 'auto', maxHeight: '180px' }}>
      {filteredItems.map((item) => (
        <div
          key={`${item._type}-${item.id}`}
          onMouseDown={(e) => {
            e.preventDefault();
            onSelect(item.name, item._type);
          }}
          style={{
            padding: '7px 12px',
            borderRadius: '6px',
            fontSize: '14px',
            lineHeight: '18px',
            color: 'rgba(255,255,255,0.60)',
            cursor: 'pointer',
            fontFamily: '"Alibaba PuHuiTi 2.0", system-ui, sans-serif',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
        >
          <span style={{
            fontSize: '11px',
            lineHeight: '16px',
            padding: '0 5px',
            borderRadius: '3px',
            backgroundColor: `${MENTION_TYPE_COLOR[item._type] ?? MENTION_TYPE_COLOR.char}22`,
            color: MENTION_TYPE_COLOR[item._type] ?? MENTION_TYPE_COLOR.char,
            flexShrink: 0,
            fontFamily: '"Alibaba PuHuiTi 2.0", system-ui, sans-serif',
          }}>
            {MENTION_TYPE_LABEL[item._type] || '其他'}
          </span>
          {item.name}
        </div>
      ))}
      </div>
    </div>,
    document.body
  );
}

// ─── 主体 Tag（提示词展示用）─────────────────────────────────────────────────────

function SubjectTag({ name, type }) {
  const color = MENTION_TYPE_COLOR[type] ?? '#E2E24B';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        paddingInline: '4px',
        borderRadius: '4px',
        fontSize: '14px',
        lineHeight: '21px',
        backgroundColor: `${color}26`,
        color,
        boxShadow: `inset 0 0 0 1px ${color}33`,
        fontFamily: '"Alibaba PuHuiTi 2.0", system-ui, sans-serif',
        flexShrink: 0,
        verticalAlign: 'middle',
      }}
    >
      @{name}
    </span>
  );
}


const MAX_PROMPT_LEN = 1000;

// ── DOM helpers for atomic mention editing ────────────────────────────────────

function buildMentionPattern(allSubjects) {
  const names = allSubjects.map((s) => s.name).filter(Boolean);
  if (names.length === 0) return null;
  return new RegExp(
    `@(${names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`,
    'g'
  );
}

function parseSegments(text, allSubjects) {
  const pattern = buildMentionPattern(allSubjects);
  const segments = [];
  let last = 0;

  // 只匹配 @名称 格式
  if (!pattern) {
    if (text) segments.push({ kind: 'text', text });
    return segments;
  }

  let m;
  while ((m = pattern.exec(text)) !== null) {
    if (m.index > last) segments.push({ kind: 'text', text: text.slice(last, m.index) });
    const name = m[0].slice(1); // 去掉 @
    const subject = allSubjects.find((s) => s.name === name);
    segments.push({ kind: 'mention', name, type: subject?._type ?? 'image' });
    last = m.index + m[0].length;
  }

  if (last < text.length) segments.push({ kind: 'text', text: text.slice(last) });
  return segments;
}

function serializeEditor(el) {
  let out = '';
  for (const node of el.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      out += node.textContent;
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      if (node.dataset?.mention) {
        // 所有提及统一序列化为 @名称
        out += `@${node.dataset.mention}`;
      } else if (node.tagName === 'BR') {
        out += '\n';
      } else {
        out += node.textContent;
      }
    }
  }
  return out;
}

function rebuildEditorDOM(el, text, allSubjects, typeOverrides = {}) {
  // typeOverrides: { [name]: type } 优先级最高，用于保留已知的正确类型
  const segs = parseSegments(text, allSubjects);
  el.innerHTML = '';
  for (const seg of segs) {
    if (seg.kind === 'text') {
      if (seg.text) el.appendChild(document.createTextNode(seg.text));
    } else {
      const type = typeOverrides[seg.name] ?? seg.type;
      const color = MENTION_TYPE_COLOR[type] ?? '#E2E24B';
      const span = document.createElement('span');
      span.dataset.mention = seg.name;
      span.dataset.mentionType = type;
      span.contentEditable = 'false';
      span.textContent = `@${seg.name}`;
      span.style.cssText = [
        'display:inline-flex', 'align-items:center', 'padding:0 4px',
        'border-radius:4px', 'font-size:14px', 'line-height:21px',
        `background:${color}26`, `color:${color}`,
        `box-shadow:inset 0 0 0 1px ${color}33`,
        'vertical-align:middle', 'user-select:none', 'cursor:default',
      ].join(';');
      el.appendChild(span);
    }
  }
  if (!el.lastChild || el.lastChild.nodeType !== Node.TEXT_NODE) {
    el.appendChild(document.createTextNode(''));
  }
}

function getCaretOffset(el) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return 0;
  const range = sel.getRangeAt(0);
  let offset = 0;
  for (const node of el.childNodes) {
    if (node === range.startContainer || node.contains?.(range.startContainer)) {
      if (node.nodeType === Node.TEXT_NODE) offset += range.startOffset;
      else if (node.dataset?.mention) {
        // 统一为 @名称 的长度
        offset += node.dataset.mention.length + 1;
      }
      break;
    }
    if (node.nodeType === Node.TEXT_NODE) offset += node.textContent.length;
    else if (node.dataset?.mention) {
      offset += node.dataset.mention.length + 1;
    }
    else offset += node.textContent.length;
  }
  return offset;
}

function setCaretOffset(el, targetOffset) {
  let remaining = targetOffset;
  for (const node of el.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      const len = node.textContent.length;
      if (remaining <= len) {
        const range = document.createRange();
        range.setStart(node, remaining);
        range.collapse(true);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        return;
      }
      remaining -= len;
    } else if (node.dataset?.mention) {
      // 统一为 @名称 的长度
      const len = node.dataset.mention.length + 1;
      if (remaining < len) {
        const range = document.createRange();
        range.setStartAfter(node);
        range.collapse(true);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        return;
      }
      remaining -= len;
    } else {
      const len = node.textContent.length;
      if (remaining <= len) {
        const range = document.createRange();
        range.setStart(node, 0);
        range.collapse(true);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        return;
      }
      remaining -= len;
    }
  }
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}

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
  const pendingMentionRef = useRef(null); // { name, type } 等待编辑器挂载后插入

  // 暴露 insertMention 方法，供外部（如参考视频卡片点击）调用
  useImperativeHandle(ref, () => ({
    insertMention(name, type) {
      const el = editorRef.current;
      if (el) {
        // 编辑器已挂载，直接插入
        doInsertMention(el, name, type);
      } else {
        // 展示态，先记录 pending，触发 focused=true 后在 useEffect 中插入
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

  // 从当前 DOM 读出已确认的 name→type 映射，防止重建时因同名条目顺序问题丢失正确类型
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
    // 把当前 DOM 里已有的类型合并进持久化 ref，防止 rebuild 时丢失
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
      // 必须先 focus，否则 window.getSelection() 无法定位光标
      el.focus();
      rebuildEditorDOM(el, value, allSubjects, typeOverridesRef.current);
      // 若有待插入的 mention（点击卡片时编辑器还未挂载），在此消费
      if (pendingMentionRef.current) {
        const { name, type } = pendingMentionRef.current;
        pendingMentionRef.current = null;
        // 光标先移到末尾，再插入
        setCaretOffset(el, value.length);
        doInsertMention(el, name, type);
      } else {
        setCaretOffset(el, value.length);
      }
    }
  }, [focused]); // eslint-disable-line react-hooks/exhaustive-deps

  // 原生 beforeinput 监听：React 合成 onBeforeInput 无法 preventDefault，必须用原生事件
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
  }, [focused]);

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
    // 只允许纯文本粘贴，剥除富文本样式（颜色、加粗等）
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
    // 设置失焦标志，防止失焦过程中的 syncToValue 调用
    isBlurringRef.current = true;
    setFocused(false);
    setMentionQuery(null);
    // 在下一帧重置标志
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

    // 统一插入 @名称
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
          /* 编辑态：contenteditable，mention span 为 contentEditable=false 原子 */
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
            className="[&:empty]:before:content-[attr(data-placeholder)] [&:empty]:before:text-[rgba(255,255,255,0.30)] [&:empty]:before:pointer-events-none"
          />
        ) : (
          /* 展示态：渲染 value 字符串，\n 由 pre-wrap 自动换行，mention 高亮 */
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
