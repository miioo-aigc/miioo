/**
 * @file useCreationPromptInteraction.js
 * @structure-index
 *
 * ─── 纯函数与 DOM 标签构造 ───────────────────────────── L29–L162
 *   文本标签辅助、MiniMax 高级配音文本序列化、情绪边界标记、情绪定义恢复
 *
 * ─── 情绪标记与菜单交互 ─────────────────────────────── L184–L375
 *   菜单定位、标签构建与删除、选区边界拆分、局部情绪替换
 *
 * ─── 提示词编辑生命周期 ─────────────────────────────── L377–L519
 *   预填充 HTML/文本、重建 @素材标签、正文选区同步、@菜单 outside click
 *
 * ─── 输入事件与素材标签操作 ─────────────────────────── L521–L976
 *   粘贴处理、文件移除、卡片插入、@菜单选择、键盘删除/提交
 *   高级配音情绪选区、菜单定位、情绪标签替换
 *
 * ─── 快照与恢复接口 ─────────────────────────────────── L978–L1043
 *   getPromptSnapshot()（含高级配音请求文本）、clearContent()、restoreContent()
 *
 * ─── 公开 Hook 接口 ──────────────────────────────────── L1045–L1079
 *   编辑器 ref、焦点/内容状态、事件回调、快照与恢复能力
 *
 * ─── 边界说明 ─────────────────────────────────────────
 *   本 Hook 只管理 contentEditable 和 @素材标签 DOM；文件列表、参数状态、生成 API、任务轮询、缓存和 Store 仍由 InputCard/CreationPage 持有。
 *
 * ─── 更新记录 ─────────────────────────────────────────
 *   2026-08-21  高级配音提交时将情绪、停顿和语气词视觉标签序列化为 MiniMax 官方 text 标记格式。
 */

import { useCallback, useEffect, useRef, useState } from 'react';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif";
const DUBBING_ADVANCED_CHARACTER_LIMIT = 3000;
const CHARACTER_LIMIT_TOAST_MESSAGE = '最多支持输入 3000 字';

const DUBBING_INTERJECTION_API_VALUES = {
  '笑声': 'laughs',
  '轻笑': 'chuckle',
  '咳嗽': 'coughs',
  '清嗓子': 'clear-throat',
  '呻吟': 'groans',
  '正常换气': 'breath',
  '喘气': 'pant',
  '吸气': 'inhale',
  '呼气': 'exhale',
  '倒吸气': 'gasps',
  '吸鼻子': 'sniffs',
  '叹气': 'sighs',
  '喷鼻息': 'snorts',
  '哼': 'humming',
  '打嗝': 'burps',
  '咂嘴': 'lip-smacking',
  '哼唱': 'humming',
  '嘶嘶声': 'hissing',
  '嗯': 'emm',
  '呃': 'emm',
  '唌': 'sneezes',
};

function normalizePauseValue(value) {
  const matchedValue = String(value || '').match(/\d+(?:\.\d+)?/);
  const seconds = Number(matchedValue?.[0]);
  if (!Number.isFinite(seconds)) return '';
  return Math.min(99.99, Math.max(0.01, seconds))
    .toFixed(2)
    .replace(/\.00$/, '')
    .replace(/(\.\d)0$/, '$1');
}

function serializeDubbingTextNode(node) {
  if (!node) return '';
  if (node.nodeType === Node.TEXT_NODE) return node.textContent || '';
  if (node.nodeType !== Node.ELEMENT_NODE) return '';
  if (node.matches('[data-file-ref], [data-voice-wrap-spacer], [data-emotion-label], [data-emotion-remove]')) return '';

  const inlineType = node.dataset.dubbingInlineTag;
  if (inlineType === 'pause') {
    const value = normalizePauseValue(node.dataset.dubbingInlineValue || node.textContent);
    return value ? `<#${value}#>` : '';
  }
  if (inlineType === 'interjection') {
    const value = DUBBING_INTERJECTION_API_VALUES[node.dataset.dubbingInlineValue || node.textContent?.trim()];
    return value ? `(${value})` : '';
  }
  if (node.dataset.emotion === 'true') {
    const key = String(node.dataset.emotionKey || '').trim();
    const content = Array.from(node.childNodes).map(serializeDubbingTextNode).join('');
    return key && content ? `{${key}}${content}{/${key}}` : content;
  }

  const content = Array.from(node.childNodes).map(serializeDubbingTextNode).join('');
  return node.tagName === 'DIV' || node.tagName === 'P' ? `${content}\n` : content;
}

function serializeDubbingText(editor) {
  return Array.from(editor?.childNodes || [])
    .map(serializeDubbingTextNode)
    .join('')
    .replace(/\n+$/, '')
    .trim();
}

function formatMentionLabel(name = '') {
  const dotIdx = name.lastIndexOf('.');
  if (dotIdx === -1) return name.length > 9 ? `${name.slice(0, 9)}…` : name;
  const base = name.slice(0, dotIdx);
  const ext = name.slice(dotIdx);
  const truncatedBase = base.length > 9 ? `${base.slice(0, 9)}…` : base;
  return truncatedBase + ext;
}

function hasEditorContent(editor) {
  if (!editor) return false;
  return Boolean(editor.querySelector('[data-file-ref]')) || Boolean(editor.innerText?.trim());
}

function getPlainTextFromNode(node) {
  if (!node) return '';
  const clone = node.cloneNode(true);
  clone.querySelectorAll?.('[data-file-ref], [data-emotion-label], [data-emotion-boundary], [data-voice-wrap-spacer]').forEach((element) => element.remove());
  return clone.innerText ?? clone.textContent ?? '';
}

function getSelectedPlainText(range) {
  if (!range || range.collapsed) return '';
  const container = document.createElement('div');
  container.appendChild(range.cloneContents());
  return getPlainTextFromNode(container);
}

function getEmotionTextElement(emotionElement) {
  return emotionElement?.querySelector('[data-emotion-text]') || emotionElement;
}

function getEmotionToneStyles(tone) {
  return tone === 'negative'
    ? { label: 'var(--color-red-500)', highlight: 'var(--color-red-alpha-20)' }
    : { label: 'var(--color-green-500)', highlight: 'var(--color-green-alpha-20)' };
}

function getRangeRect(range) {
  const rects = Array.from(range.getClientRects());
  if (rects.length > 0) return rects[rects.length - 1];
  return range.getBoundingClientRect();
}

function unwrapEmotionElement(emotionElement) {
  if (!emotionElement?.parentNode) return;
  const textElement = getEmotionTextElement(emotionElement);
  const fragment = document.createDocumentFragment();
  while (textElement.firstChild) fragment.appendChild(textElement.firstChild);
  emotionElement.replaceWith(fragment);
}

function createEmotionBoundary(name) {
  const marker = document.createElement('span');
  marker.dataset.emotionBoundary = name;
  marker.contentEditable = 'false';
  marker.style.cssText = 'display:inline;width:0;height:0;overflow:hidden;';
  return marker;
}

function getEmotionDefinition(emotionElement) {
  const negativeKeys = new Set(['fearful', 'sad', 'angry', 'disgusted']);
  const key = emotionElement.dataset.emotionKey || '';
  return {
    key,
    label: emotionElement.querySelector('[data-emotion-label]')?.firstChild?.textContent || '',
    tone: emotionElement.dataset.emotionTone || (negativeKeys.has(key) ? 'negative' : 'positive'),
  };
}

/**
 * 创作输入区的提示词交互边界。
 *
 * 负责 contentEditable、@素材标签、光标恢复、粘贴处理、提示词预填充和
 * 失败回退所需的 DOM 操作；文件状态、生成请求和参数状态仍由 InputCard 持有。
 */
export function useCreationPromptInteraction({
  files,
  disabled = false,
  genType,
  refMode,
  showToast,
  handleFileSelect,
  removeFile,
  prefillVersion = 0,
  prefillData = null,
  dubbingAdvancedEnabled = false,
  onTextChange,
}) {
  const [focused, setFocused] = useState(false);
  const [hasContent, setHasContent] = useState(false);
  const [hasTextSelection, setHasTextSelection] = useState(false);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionPos, setMentionPos] = useState({ top: 0, left: 0 });
  const [mentionAnchorRange, setMentionAnchorRange] = useState(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionTargetTag, setMentionTargetTag] = useState(null);
  const [emotionMenuPosition, setEmotionMenuPosition] = useState(null);
  const [emotionMenuSelectedEmotion, setEmotionMenuSelectedEmotion] = useState(null);
  const [pauseMenuPosition, setPauseMenuPosition] = useState(null);
  const [interjectionMenuPosition, setInterjectionMenuPosition] = useState(null);
  const editorRef = useRef(null);
  const mentionMenuRef = useRef(null);
  const mentionFromTagRef = useRef(false);
  const savedCursorRangeRef = useRef(null);
  const emotionRangeRef = useRef(null);
  const inlineInsertRangeRef = useRef(null);
  const lastValidEditorHtmlRef = useRef('');
  const characterLimitToastAtRef = useRef(0);

  const showCharacterLimitToast = useCallback(() => {
    const now = Date.now();
    if (now - characterLimitToastAtRef.current < 1200) return;
    characterLimitToastAtRef.current = now;
    showToast?.('warning', CHARACTER_LIMIT_TOAST_MESSAGE);
  }, [showToast]);

  const positionEmotionMenu = useCallback((range) => {
    const rect = getRangeRect(range);
    const menuWidth = 166;
    const menuHeight = 134;
    const gap = 8;
    const margin = 8;
    const anchorX = rect.left + (rect.width / 2);
    const belowTop = rect.bottom + gap;
    const aboveTop = rect.top - menuHeight - gap;
    const top = belowTop + menuHeight <= window.innerHeight - margin
      ? belowTop
      : aboveTop >= margin
        ? aboveTop
        : Math.max(margin, Math.min(belowTop, window.innerHeight - menuHeight - margin));
    const left = Math.max(margin, Math.min(anchorX - (menuWidth / 2), window.innerWidth - menuWidth - margin));
    setEmotionMenuPosition({ top, left });
  }, []);

  const openEmotionMenuForRange = useCallback((range, selectedEmotion = null) => {
    if (disabled || !editorRef.current) return;
    emotionRangeRef.current = range.cloneRange();
    setEmotionMenuSelectedEmotion(selectedEmotion);
    positionEmotionMenu(range);
  }, [disabled, positionEmotionMenu]);

  const handleEmotionTagClick = useCallback((event, emotionElement) => {
    event.preventDefault();
    event.stopPropagation();
    const textElement = getEmotionTextElement(emotionElement);
    const range = document.createRange();
    range.selectNodeContents(textElement);
    setHasTextSelection(true);
    openEmotionMenuForRange(range, emotionElement.dataset.emotionKey || null);
  }, [openEmotionMenuForRange]);

  const removeEmotion = useCallback((event, emotionElement) => {
    event.preventDefault();
    event.stopPropagation();
    const editor = editorRef.current;
    if (!editor || !emotionElement?.isConnected) return;

    unwrapEmotionElement(emotionElement);
    window.getSelection()?.removeAllRanges();
    setEmotionMenuPosition(null);
    setEmotionMenuSelectedEmotion(null);
    emotionRangeRef.current = null;
    setHasTextSelection(false);
    editor.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'formatRemove' }));
    editor.focus();
  }, []);

  const bindEmotionElement = useCallback((wrapper) => {
    const label = wrapper.querySelector('[data-emotion-label]');
    if (!label) return wrapper;
    const tone = getEmotionToneStyles(wrapper.dataset.emotionTone);
    wrapper.style.background = tone.highlight;
    label.style.cssText = `display:inline-flex;position:relative;overflow:visible;align-items:center;height:20px;margin-right:4px;padding:0 6px;border-radius:6px 0 0 6px;background:${tone.label};color:#FFFFFF;font-family:${FONT};font-size:14px;line-height:16px;vertical-align:middle;cursor:pointer;`;
    let closeButton = wrapper.querySelector('[data-emotion-remove]');
    if (!closeButton) {
      closeButton = document.createElement('span');
      closeButton.dataset.emotionRemove = 'true';
      closeButton.contentEditable = 'false';
      closeButton.setAttribute('role', 'button');
      closeButton.setAttribute('aria-label', '移除情绪');
      label.appendChild(closeButton);
    }
    closeButton.innerHTML = '<svg width="10" height="10" viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="display:block;overflow:visible;flex-shrink:0"><path d="M1.666 1.666L8.334 8.334" fill="none" stroke="#FFFFFF" stroke-linecap="round" stroke-linejoin="round"/><path d="M1.666 8.334L8.334 1.666" fill="none" stroke="#FFFFFF" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    closeButton.style.cssText = 'display:flex;position:absolute;left:29px;top:-7px;z-index:2;align-items:center;justify-content:center;padding:2px;border:1px solid rgba(255,255,255,0.08);border-radius:50%;background:rgba(0,0,0,0.50);opacity:0;visibility:hidden;pointer-events:none;cursor:pointer;transition:opacity 120ms ease;';
    label.style.position = 'relative';
    label.style.overflow = 'visible';
    label.addEventListener('mousedown', (event) => event.preventDefault());
    label.addEventListener('click', (event) => handleEmotionTagClick(event, wrapper));
    const showCloseButton = () => {
      if (!closeButton) return;
      closeButton.style.opacity = '1';
      closeButton.style.visibility = 'visible';
      closeButton.style.pointerEvents = 'auto';
    };
    const hideCloseButton = () => {
      if (!closeButton) return;
      closeButton.style.opacity = '0';
      closeButton.style.visibility = 'hidden';
      closeButton.style.pointerEvents = 'none';
    };
    label.addEventListener('mouseenter', showCloseButton);
    label.addEventListener('mouseleave', hideCloseButton);
    wrapper.addEventListener('mouseenter', showCloseButton);
    wrapper.addEventListener('mouseleave', hideCloseButton);
    closeButton?.addEventListener('mousedown', (event) => event.preventDefault());
    closeButton?.addEventListener('click', (event) => removeEmotion(event, wrapper));
    return wrapper;
  }, [handleEmotionTagClick, removeEmotion]);

  const buildEmotionElement = useCallback((emotion, content) => {
    const tone = getEmotionToneStyles(emotion.tone);
    const wrapper = document.createElement('span');
    wrapper.dataset.emotion = 'true';
    wrapper.dataset.emotionKey = emotion.key;
    wrapper.dataset.emotionTone = emotion.tone;
    wrapper.style.cssText = `display:inline;line-height:inherit;background:${tone.highlight};border-radius:0 6px 6px 0;color:#FFFFFF;`;

    const label = document.createElement('span');
    label.dataset.emotionLabel = 'true';
    label.contentEditable = 'false';
    label.textContent = emotion.label;
    label.style.cssText = `display:inline-flex;position:relative;overflow:visible;align-items:center;height:20px;margin-right:4px;padding:0 6px;border-radius:6px 0 0 6px;background:${tone.label};color:#FFFFFF;font-family:${FONT};font-size:14px;line-height:16px;vertical-align:middle;cursor:pointer;`;
    const textElement = document.createElement('span');
    textElement.dataset.emotionText = 'true';
    textElement.contentEditable = 'true';
    if (typeof content === 'string') textElement.textContent = content;
    else if (content) textElement.appendChild(content);
    wrapper.append(label, textElement);
    return bindEmotionElement(wrapper);
  }, [bindEmotionElement]);

  const splitEmotionsAtBoundaries = useCallback((editor) => {
    const wrappers = Array.from(editor.querySelectorAll('[data-emotion]'));
    wrappers.forEach((wrapper) => {
      const textElement = getEmotionTextElement(wrapper);
      if (!textElement.querySelector('[data-emotion-boundary]')) return;

      const emotion = getEmotionDefinition(wrapper);
      const replacement = document.createDocumentFragment();
      let run = document.createDocumentFragment();
      const flushRun = () => {
        if (!run.hasChildNodes()) return;
        replacement.appendChild(buildEmotionElement(emotion, run));
        run = document.createDocumentFragment();
      };

      Array.from(textElement.childNodes).forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE && node.hasAttribute('data-emotion-boundary')) {
          flushRun();
          replacement.appendChild(node);
          return;
        }
        run.appendChild(node);
      });
      flushRun();
      wrapper.replaceWith(replacement);
    });
  }, [buildEmotionElement]);

  const applyEmotion = useCallback((emotion) => {
    const editor = editorRef.current;
    const savedRange = emotionRangeRef.current;
    if (!editor || !savedRange) return;

    const endBoundary = createEmotionBoundary('end');
    const endRange = savedRange.cloneRange();
    endRange.collapse(false);
    endRange.insertNode(endBoundary);
    const startBoundary = createEmotionBoundary('start');
    const startRange = savedRange.cloneRange();
    startRange.collapse(true);
    startRange.insertNode(startBoundary);

    splitEmotionsAtBoundaries(editor);
    const replacementRange = document.createRange();
    replacementRange.setStartAfter(startBoundary);
    replacementRange.setEndBefore(endBoundary);
    const content = replacementRange.extractContents();
    content.querySelectorAll?.('[data-emotion-label]').forEach((label) => label.remove());
    Array.from(content.querySelectorAll?.('[data-emotion]') || []).forEach(unwrapEmotionElement);
    replacementRange.insertNode(buildEmotionElement(emotion, content));
    startBoundary.remove();
    endBoundary.remove();

    setEmotionMenuPosition(null);
    setEmotionMenuSelectedEmotion(null);
    emotionRangeRef.current = null;
    setHasTextSelection(false);
    editor.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'formatSetBlockTextDirection' }));
    editor.focus();
  }, [buildEmotionElement, splitEmotionsAtBoundaries]);

  const openEmotionMenu = useCallback(() => {
    const range = emotionRangeRef.current;
    if (!range || !hasTextSelection || disabled) return;
    positionEmotionMenu(range);
  }, [disabled, hasTextSelection, positionEmotionMenu]);

  const positionInlineMenu = useCallback((range, menuWidth, menuHeight) => {
    const rect = getRangeRect(range);
    const editorRect = editorRef.current?.getBoundingClientRect();
    if (!editorRect) return { top: 0, left: 0 };
    const gap = 8;
    const margin = 8;
    const belowTop = rect.bottom + gap;
    const aboveTop = rect.top - menuHeight - gap;
    const top = belowTop + menuHeight <= window.innerHeight - margin
      ? belowTop
      : aboveTop >= margin
        ? aboveTop
        : Math.max(margin, Math.min(belowTop, window.innerHeight - menuHeight - margin));
    const left = Math.max(margin, Math.min(rect.left, window.innerWidth - menuWidth - margin));
    return {
      top: top - editorRect.top,
      left: left - editorRect.left,
    };
  }, []);

  const getCursorRange = useCallback(() => {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (selection?.rangeCount && editor?.contains(selection.getRangeAt(0).startContainer)) {
      return selection.getRangeAt(0).cloneRange();
    }
    if (savedCursorRangeRef.current && editor?.contains(savedCursorRangeRef.current.startContainer)) {
      return savedCursorRangeRef.current.cloneRange();
    }
    if (!editor) return null;
    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    return range;
  }, []);

  const openInlineMenu = useCallback((kind) => {
    if (disabled || !dubbingAdvancedEnabled || genType !== 'dubbing') return;
    const range = getCursorRange();
    if (!range) return;
    inlineInsertRangeRef.current = range;
    const position = positionInlineMenu(range, kind === 'pause' ? 300 : 100, kind === 'pause' ? 58 : 180);
    if (kind === 'pause') {
      setInterjectionMenuPosition(null);
      setPauseMenuPosition(position);
    } else {
      setPauseMenuPosition(null);
      setInterjectionMenuPosition(position);
    }
  }, [disabled, dubbingAdvancedEnabled, genType, getCursorRange, positionInlineMenu]);

  const openInlineMenuForTag = useCallback((tag) => {
    if (disabled || !dubbingAdvancedEnabled || genType !== 'dubbing' || !tag) return;
    const range = document.createRange();
    range.selectNode(tag);
    inlineInsertRangeRef.current = range;
    const kind = tag.dataset.dubbingInlineTag === 'pause' ? 'pause' : 'interjection';
    const position = positionInlineMenu(range, kind === 'pause' ? 300 : 100, kind === 'pause' ? 58 : 180);
    setPauseMenuPosition(kind === 'pause' ? position : null);
    setInterjectionMenuPosition(kind === 'interjection' ? position : null);
  }, [disabled, dubbingAdvancedEnabled, genType, positionInlineMenu]);

  const buildInlineTag = useCallback((text, type) => {
    const tag = document.createElement('span');
    tag.contentEditable = 'false';
    tag.dataset.dubbingInlineTag = type;
    tag.dataset.dubbingInlineValue = text;
    tag.textContent = text;
    tag.style.cssText = type === 'pause'
      ? 'display:inline-flex;align-items:center;height:20px;margin:0 2px;padding:1px 8px;border-radius:6px;box-shadow:inset 0 0 0 1px rgba(255,255,255,0.08);background:rgba(45,195,225,0.10);color:#2DC3E1;font-family:' + FONT + ';font-size:14px;line-height:18px;vertical-align:middle;user-select:none;white-space:nowrap;cursor:pointer;'
      : 'display:inline-flex;align-items:center;height:20px;margin:0 2px;padding:1px 8px;border-radius:6px;box-shadow:inset 0 0 0 1px rgba(255,255,255,0.08);background:rgba(232,161,255,0.10);color:#E8A1FF;font-family:' + FONT + ';font-size:14px;line-height:18px;vertical-align:middle;user-select:none;white-space:nowrap;cursor:pointer;';
    return tag;
  }, []);

  const insertInlineTag = useCallback((value, type) => {
    const editor = editorRef.current;
    const savedRange = inlineInsertRangeRef.current;
    if (!editor || !savedRange) return;
    const range = savedRange.cloneRange();
    editor.focus();
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    range.deleteContents();
    const tag = buildInlineTag(value, type);
    range.insertNode(tag);
    const afterRange = document.createRange();
    afterRange.setStartAfter(tag);
    afterRange.collapse(true);
    selection?.removeAllRanges();
    selection?.addRange(afterRange);
    savedCursorRangeRef.current = afterRange.cloneRange();
    inlineInsertRangeRef.current = null;
    setPauseMenuPosition(null);
    setInterjectionMenuPosition(null);
    setHasContent(true);
    editor.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }));
  }, [buildInlineTag]);

  const handleTagClick = useCallback((event, tagElement) => {
    event.preventDefault();
    event.stopPropagation();
    if (disabled || !editorRef.current) return;

    mentionFromTagRef.current = true;
    setMentionTargetTag(tagElement);
    setMentionQuery('');
    setMentionAnchorRange(null);
    const rect = tagElement.getBoundingClientRect();
    const editorRect = editorRef.current.getBoundingClientRect();
    setMentionPos({
      top: rect.bottom - editorRect.top + 4,
      left: Math.max(0, rect.left - editorRect.left),
    });
    setMentionOpen(true);
  }, [disabled]);

  const buildTagElement = useCallback((file) => {
    const tag = document.createElement('span');
    tag.contentEditable = 'false';
    tag.dataset.fileRef = file._uid || file.name;
    tag.dataset.fileName = file.name || '';
    tag.style.cssText = 'display:inline-flex;align-items:center;background:rgba(45,195,225,0.10);color:#2DC3E1;border-radius:6px;padding:0 4px;font-size:14px;line-height:22px;height:22px;box-shadow:inset 0 0 0 1px rgba(255,255,255,0.08);user-select:none;cursor:pointer;white-space:nowrap;font-family:' + FONT + ';';

    const label = document.createElement('span');
    label.textContent = formatMentionLabel(file.name);
    label.style.cssText = 'pointer-events:none;';
    tag.appendChild(label);

    const closeButton = document.createElement('span');
    closeButton.style.cssText = 'display:none;width:12px;height:12px;margin-left:3px;border-radius:50%;background:rgba(255,255,255,0.15);align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;';
    closeButton.innerHTML = '<svg width="7" height="7" viewBox="0 0 8 8" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1.5 1.5L6.5 6.5M6.5 1.5L1.5 6.5" stroke="#FFFFFFCC" stroke-width="1.2" stroke-linecap="round"/></svg>';
    closeButton.addEventListener('mousedown', (event) => {
      event.preventDefault();
      event.stopPropagation();
      tag.remove();
      setHasContent(hasEditorContent(editorRef.current));
    });
    tag.appendChild(closeButton);

    tag.addEventListener('mouseenter', () => {
      closeButton.style.display = 'inline-flex';
    });
    tag.addEventListener('mouseleave', () => {
      closeButton.style.display = 'none';
    });
    tag.addEventListener('click', (event) => handleTagClick(event, tag));

    return tag;
  }, [handleTagClick]);

  useEffect(() => {
    if (!prefillVersion || !prefillData || !editorRef.current) return;
    if (prefillData.prompt !== undefined) {
      editorRef.current.innerHTML = '';
      if (prefillData.promptHTML) {
        editorRef.current.innerHTML = prefillData.promptHTML;
        const filesToUse = prefillData.files ?? [];
        editorRef.current.querySelectorAll('[data-file-ref]').forEach((oldTag) => {
          const fileRef = oldTag.dataset.fileRef;
          const fileName = oldTag.dataset.fileName;
          const file = filesToUse.find((item) => (item._uid || item.name) === fileRef)
            || filesToUse.find((item) => item.name === fileName)
            || { name: fileName || fileRef, url: '', size: 0, _uid: fileRef };
          const newTag = buildTagElement(file);
          oldTag.parentNode?.replaceChild(newTag, oldTag);
        });
        editorRef.current.querySelectorAll('[data-emotion]').forEach(bindEmotionElement);
      } else if (prefillData.prompt) {
        editorRef.current.textContent = prefillData.prompt;
      }
      lastValidEditorHtmlRef.current = editorRef.current.innerHTML;
      // 空 HTML（如浏览器保留的 <br>）不应遮蔽占位符；@素材标签仍视为输入内容。
      setHasContent(hasEditorContent(editorRef.current));
      onTextChange?.(String(prefillData.prompt ?? ''));
    }
  // prefillVersion 是外部约定的唯一触发信号，不能因 prefillData 对象重建而重复覆盖编辑器内容。
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildTagElement, prefillVersion]);

  useEffect(() => {
    const handleSelectionChange = () => {
      const editor = editorRef.current;
      const selection = window.getSelection();
      if (!editor || !selection || selection.rangeCount === 0 || selection.isCollapsed) {
        setHasTextSelection(false);
        setEmotionMenuPosition(null);
        setEmotionMenuSelectedEmotion(null);
        emotionRangeRef.current = null;
        return;
      }

      const range = selection.getRangeAt(0);
      const selectionBelongsToEditor = editor.contains(range.startContainer) && editor.contains(range.endContainer);
      const hasSelection = selectionBelongsToEditor && selection.toString().trim().length > 0;
      setHasTextSelection(hasSelection);
      if (hasSelection && genType === 'dubbing' && dubbingAdvancedEnabled) {
        const emotionAncestor = range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
          ? range.commonAncestorContainer.closest?.('[data-emotion]')
          : range.commonAncestorContainer.parentElement?.closest?.('[data-emotion]');
        emotionRangeRef.current = range.cloneRange();
        setEmotionMenuSelectedEmotion(emotionAncestor?.dataset.emotionKey || null);
        setEmotionMenuPosition(null);
      } else if (!hasSelection) {
        setEmotionMenuPosition(null);
        setEmotionMenuSelectedEmotion(null);
        emotionRangeRef.current = null;
      }
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, [dubbingAdvancedEnabled, genType]);

  useEffect(() => {
    if (!mentionOpen) return undefined;
    const handleOutside = (event) => {
      if (mentionMenuRef.current && mentionMenuRef.current.contains(event.target)) return;
      if (editorRef.current && editorRef.current.contains(event.target)) return;
      setMentionOpen(false);
      setMentionTargetTag(null);
      mentionFromTagRef.current = false;
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [mentionOpen]);

  useEffect(() => {
    if (!dubbingAdvancedEnabled) return undefined;
    const handleEmotionDismissMouseDown = (event) => {
      if (event.target.closest?.('[role="menu"][aria-label="情绪选择"]')) return;
      if (event.target.closest?.('button[aria-label="情绪"]')) return;
      if (event.target.closest?.('[data-emotion-label]')) return;

      window.getSelection()?.removeAllRanges();
      setHasTextSelection(false);
      setEmotionMenuPosition(null);
      setEmotionMenuSelectedEmotion(null);
      emotionRangeRef.current = null;
    };
    document.addEventListener('mousedown', handleEmotionDismissMouseDown);
    return () => document.removeEventListener('mousedown', handleEmotionDismissMouseDown);
  }, [dubbingAdvancedEnabled]);

  useEffect(() => {
    if (!pauseMenuPosition && !interjectionMenuPosition) return undefined;
    const handleInlineMenuDismiss = (event) => {
      if (event.target.closest?.('[role="menu"][aria-label="停顿时长"]')) return;
      if (event.target.closest?.('[role="menu"][aria-label="语气词"]')) return;
      if (event.target.closest?.('button[aria-label="停顿"]')) return;
      if (event.target.closest?.('button[aria-label="语气词"]')) return;
      if (event.target.closest?.('[data-dubbing-inline-tag]')) return;
      setPauseMenuPosition(null);
      setInterjectionMenuPosition(null);
      inlineInsertRangeRef.current = null;
    };
    document.addEventListener('mousedown', handleInlineMenuDismiss);
    return () => document.removeEventListener('mousedown', handleInlineMenuDismiss);
  }, [interjectionMenuPosition, pauseMenuPosition]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !dubbingAdvancedEnabled || genType !== 'dubbing') return undefined;
    const handleInlineTagClick = (event) => {
      const tag = event.target.closest?.('[data-dubbing-inline-tag]');
      if (!tag || !editor.contains(tag)) return;
      event.preventDefault();
      event.stopPropagation();
      openInlineMenuForTag(tag);
    };
    editor.addEventListener('click', handleInlineTagClick);
    return () => editor.removeEventListener('click', handleInlineTagClick);
  }, [dubbingAdvancedEnabled, genType, openInlineMenuForTag]);

  const handlePaste = useCallback((event) => {
    const items = event.clipboardData?.items;
    if (!items) return;
    const imageFiles = [];
    const mediaFiles = [];
    for (const item of items) {
      if (item.kind !== 'file') continue;
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) imageFiles.push(file);
      } else if (item.type.startsWith('video/') || item.type.startsWith('audio/')) {
        const file = item.getAsFile();
        if (file) mediaFiles.push(file);
      }
    }
    if (imageFiles.length > 0) {
      event.preventDefault();
      if (refMode === 'frame') {
        showToast?.('info', '首尾帧模式下不支持粘贴参考图，请使用首尾帧上传槽');
      } else {
        handleFileSelect(imageFiles);
      }
      return;
    }
    if (mediaFiles.length > 0) {
      event.preventDefault();
      if (genType === 'image' || refMode === 'frame') {
        showToast?.('error', '不支持的文件格式！');
      } else {
        handleFileSelect(mediaFiles);
      }
      return;
    }
    event.preventDefault();
    const text = event.clipboardData.getData('text/plain');
    if (!text) return;
    if (genType === 'dubbing' && dubbingAdvancedEnabled) {
      const editor = editorRef.current;
      const selection = window.getSelection();
      const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
      const currentLength = getPlainTextFromNode(editor).length;
      const selectedLength = range && editor?.contains(range.commonAncestorContainer)
        ? getSelectedPlainText(range).length
        : 0;
      const availableLength = Math.max(0, DUBBING_ADVANCED_CHARACTER_LIMIT - currentLength + selectedLength);
      const acceptedText = text.slice(0, availableLength);
      if (acceptedText) document.execCommand('insertText', false, acceptedText);
      if (acceptedText.length < text.length) showCharacterLimitToast();
      return;
    }
    document.execCommand('insertText', false, text);
  }, [dubbingAdvancedEnabled, genType, handleFileSelect, refMode, showCharacterLimitToast, showToast]);

  const handleRemoveFile = useCallback((index) => {
    const file = files[index];
    removeFile(index);
    if (file && editorRef.current) {
      editorRef.current.querySelectorAll('[data-file-ref]').forEach((tag) => {
        if (tag.dataset.fileRef === (file._uid || file.name)) tag.remove();
      });
      setHasContent(hasEditorContent(editorRef.current));
    }
  }, [files, removeFile]);

  const insertFromCard = useCallback((file) => {
    const editor = editorRef.current;
    if (!editor) return;
    const selection = window.getSelection();
    let range;
    if (selection && selection.rangeCount > 0 && editor.contains(selection.getRangeAt(0).startContainer)) {
      range = selection.getRangeAt(0);
    } else if (savedCursorRangeRef.current && editor.contains(savedCursorRangeRef.current.startContainer)) {
      range = savedCursorRangeRef.current;
      selection.removeAllRanges();
      selection.addRange(range);
    } else {
      range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    }
    editor.focus();
    const tag = buildTagElement(file);
    range.deleteContents();
    range.insertNode(tag);
    const afterRange = document.createRange();
    afterRange.setStartAfter(tag);
    afterRange.collapse(true);
    selection.removeAllRanges();
    selection.addRange(afterRange);
    savedCursorRangeRef.current = null;
    setHasContent(true);
  }, [buildTagElement]);

  const insertMention = useCallback((file) => {
    setMentionOpen(false);
    const targetTag = mentionTargetTag;
    if (targetTag) {
      const newTag = buildTagElement(file);
      targetTag.replaceWith(newTag);
      setMentionTargetTag(null);
      editorRef.current?.focus();
      setHasContent(true);
      return;
    }
    const savedRange = mentionAnchorRange;
    if (!savedRange) return;
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(savedRange);
    const range = selection.getRangeAt(0);
    const textNode = range.startContainer;
    if (textNode.nodeType !== Node.TEXT_NODE) return;
    const textBefore = textNode.textContent.slice(0, range.startOffset);
    const atIdx = textBefore.lastIndexOf('@');
    if (atIdx === -1) return;
    const deleteRange = document.createRange();
    deleteRange.setStart(textNode, atIdx);
    deleteRange.setEnd(textNode, range.startOffset);
    deleteRange.deleteContents();
    const tag = buildTagElement(file);
    deleteRange.insertNode(tag);
    const afterRange = document.createRange();
    afterRange.setStartAfter(tag);
    afterRange.collapse(true);
    selection.removeAllRanges();
    selection.addRange(afterRange);
    editorRef.current?.focus();
    setHasContent(true);
  }, [buildTagElement, mentionAnchorRange, mentionTargetTag]);

  const handleInput = useCallback(() => {
    const editor = editorRef.current;
    if (genType === 'dubbing' && dubbingAdvancedEnabled && getPlainTextFromNode(editor).length > DUBBING_ADVANCED_CHARACTER_LIMIT) {
      editor.innerHTML = lastValidEditorHtmlRef.current;
      editor.querySelectorAll('[data-emotion]').forEach(bindEmotionElement);
      showCharacterLimitToast();
    } else if (editor) {
      lastValidEditorHtmlRef.current = editor.innerHTML;
    }
    setHasContent(hasEditorContent(editorRef.current));
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) {
      setMentionOpen(false);
      return;
    }
    const range = selection.getRangeAt(0);
    if (range.startContainer.nodeType !== Node.TEXT_NODE) {
      setMentionOpen(false);
      return;
    }
    const textBefore = range.startContainer.textContent.slice(0, range.startOffset);
    const atIdx = textBefore.lastIndexOf('@');
    if (atIdx !== -1) {
      const query = textBefore.slice(atIdx + 1);
      if (!query.includes(' ') && !query.includes('\n')) {
        setMentionQuery(query);
        setMentionIndex(0);
        setMentionOpen(true);
        const rect = range.getBoundingClientRect();
        const editorRect = editorRef.current.getBoundingClientRect();
        setMentionPos({ top: rect.bottom - editorRect.top + 4, left: Math.max(0, rect.left - editorRect.left) });
        setMentionAnchorRange(range.cloneRange());
        return;
      }
    }
    setMentionOpen(false);
  }, [bindEmotionElement, dubbingAdvancedEnabled, genType, showCharacterLimitToast]);

  const handleBeforeInput = useCallback((event) => {
    if (!dubbingAdvancedEnabled || genType !== 'dubbing') return;
    const inputType = event.nativeEvent.inputType;
    const insertsText = inputType === 'insertText' || inputType === 'insertCompositionText';
    const insertsLineBreak = inputType === 'insertLineBreak' || inputType === 'insertParagraph';
    if (!insertsText && !insertsLineBreak) return;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    const editor = editorRef.current;
    if (!editor || !editor.contains(range.commonAncestorContainer)) return;
    const insertedText = insertsLineBreak ? '\n' : (event.nativeEvent.data || '');
    const currentLength = getPlainTextFromNode(editor).length;
    const selectedLength = getSelectedPlainText(range).length;
    const availableLength = Math.max(0, DUBBING_ADVANCED_CHARACTER_LIMIT - currentLength + selectedLength);
    if (insertedText.length > availableLength) {
      event.preventDefault();
      const acceptedText = insertedText.slice(0, availableLength);
      if (acceptedText) document.execCommand('insertText', false, acceptedText);
      showCharacterLimitToast();
      return;
    }
    if (event.nativeEvent.isComposing || inputType !== 'insertText' || !selection.isCollapsed || !event.nativeEvent.data) return;
    const textElement = range.startContainer.nodeType === Node.TEXT_NODE
      ? range.startContainer.parentElement?.closest?.('[data-emotion-text]')
      : range.startContainer.closest?.('[data-emotion-text]');
    const emotionElement = textElement?.closest('[data-emotion]');
    if (!textElement || !emotionElement) return;

    const boundaryRange = document.createRange();
    boundaryRange.selectNodeContents(textElement);
    const atStart = range.compareBoundaryPoints(Range.START_TO_START, boundaryRange) === 0;
    const atEnd = range.compareBoundaryPoints(Range.START_TO_END, boundaryRange) === 0;
    if (!atStart && !atEnd) return;

    event.preventDefault();
    const textNode = document.createTextNode(event.nativeEvent.data);
    emotionElement.parentNode?.insertBefore(textNode, atStart ? emotionElement : emotionElement.nextSibling);
    const nextRange = document.createRange();
    nextRange.setStart(textNode, textNode.textContent.length);
    nextRange.collapse(true);
    selection.removeAllRanges();
    selection.addRange(nextRange);
    editorRef.current?.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: event.nativeEvent.data }));
  }, [dubbingAdvancedEnabled, genType, showCharacterLimitToast]);

  const handleEditorBlur = useCallback(() => {
    setFocused(false);
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      savedCursorRangeRef.current = selection.getRangeAt(0).cloneRange();
    }
    if (mentionFromTagRef.current) {
      mentionFromTagRef.current = false;
    } else {
      setMentionOpen(false);
      setMentionTargetTag(null);
    }
  }, []);

  const handleEditorFocus = useCallback(() => {
    setFocused(true);
  }, []);

  const handleKeyDown = useCallback((event, onSubmit) => {
    if (mentionOpen) {
      const mentionFiles = files.filter((file) => (
        mentionQuery === '' || file.name.toLowerCase().includes(mentionQuery.toLowerCase())
      ));
      if (event.key === 'Escape') {
        event.preventDefault();
        setMentionOpen(false);
        return;
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setMentionIndex((index) => mentionFiles.length ? (index + 1) % mentionFiles.length : 0);
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setMentionIndex((index) => mentionFiles.length ? (index - 1 + mentionFiles.length) % mentionFiles.length : 0);
        return;
      }
      if (event.key === 'Enter' && mentionFiles.length > 0) {
        if (event.nativeEvent.isComposing) return;
        event.preventDefault();
        insertMention(mentionFiles[mentionIndex] || mentionFiles[0]);
        return;
      }
    }
    if (event.key === 'Backspace' || event.key === 'Delete') {
      const selection = window.getSelection();
      if (!selection || !selection.rangeCount) return;
      const range = selection.getRangeAt(0);
      if (!range.collapsed) return;
      let tagToRemove = null;
      if (event.key === 'Backspace') {
        const { startContainer, startOffset } = range;
        if (startOffset === 0 && startContainer.previousSibling?.dataset?.fileRef) {
          tagToRemove = startContainer.previousSibling;
        } else if (startContainer.nodeType === Node.TEXT_NODE && startOffset === 0) {
          const previous = startContainer.previousSibling;
          if (previous?.dataset?.fileRef) tagToRemove = previous;
        }
      } else {
        const { startContainer, startOffset } = range;
        if (startContainer.nodeType === Node.TEXT_NODE && startOffset === startContainer.textContent.length) {
          const next = startContainer.nextSibling;
          if (next?.dataset?.fileRef) tagToRemove = next;
        } else if (startContainer.nextSibling?.dataset?.fileRef) {
          tagToRemove = startContainer.nextSibling;
        }
      }
      if (tagToRemove) {
        event.preventDefault();
        tagToRemove.remove();
        setHasContent(hasEditorContent(editorRef.current));
        return;
      }
    }
    if (event.key === 'Enter' && !event.shiftKey) {
      if (event.nativeEvent.isComposing) return;
      event.preventDefault();
      onSubmit?.();
    }
  }, [files, insertMention, mentionIndex, mentionOpen, mentionQuery]);

  const getPromptSnapshot = useCallback(() => {
    if (!editorRef.current) return { text: '', html: '' };
    const clone = editorRef.current.cloneNode(true);
    clone.querySelectorAll('[data-file-ref], [data-voice-wrap-spacer]').forEach((element) => element.remove());
    clone.querySelectorAll('[data-emotion-label]').forEach((element) => element.remove());
    return {
      text: clone.innerText?.trim() ?? '',
      requestText: genType === 'dubbing' && dubbingAdvancedEnabled
        ? serializeDubbingText(editorRef.current)
        : clone.innerText?.trim() ?? '',
      html: editorRef.current.innerHTML ?? '',
    };
  }, [dubbingAdvancedEnabled, genType]);

  const clearContent = useCallback(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = '';
      lastValidEditorHtmlRef.current = '';
    }
    setHasContent(false);
  }, []);

  const clearAdvancedContent = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;

    // 情绪保留正文、移除标签；停顿和语气词连同标签内容一起删除。
    Array.from(editor.querySelectorAll('[data-emotion]')).forEach(unwrapEmotionElement);
    editor.querySelectorAll('[data-dubbing-inline-tag]').forEach((element) => element.remove());
    editor.querySelectorAll('[data-emotion-label], [data-emotion-remove]').forEach((element) => element.remove());
    lastValidEditorHtmlRef.current = editor.innerHTML;
    setEmotionMenuPosition(null);
    setEmotionMenuSelectedEmotion(null);
    setPauseMenuPosition(null);
    setInterjectionMenuPosition(null);
    emotionRangeRef.current = null;
    inlineInsertRangeRef.current = null;
    setHasTextSelection(false);
    setHasContent(hasEditorContent(editor));
    onTextChange?.(getPlainTextFromNode(editor));
    editor.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'formatRemove' }));
  }, [onTextChange]);

  const restoreContent = useCallback(({ html = '', text = '', fallback = '', restoreFiles = [] } = {}) => {
    if (!editorRef.current) return;
    if (html) {
      editorRef.current.innerHTML = html;
      Array.from(editorRef.current.querySelectorAll('[data-file-ref]')).forEach((oldTag) => {
        const fileRef = oldTag.dataset.fileRef;
        const fileName = oldTag.dataset.fileName;
        const file = restoreFiles.find((item) => (item._uid || item.name) === fileRef)
          || restoreFiles.find((item) => item.name === fileName)
          || { name: fileName || fileRef, url: '', size: 0, _uid: fileRef };
        oldTag.parentNode?.replaceChild(buildTagElement(file), oldTag);
      });
      editorRef.current.querySelectorAll('[data-emotion]').forEach(bindEmotionElement);
      lastValidEditorHtmlRef.current = editorRef.current.innerHTML;
      setHasContent(hasEditorContent(editorRef.current));
      onTextChange?.(text || fallback);
      return;
    }
    const content = text || fallback;
    editorRef.current.innerText = content;
    lastValidEditorHtmlRef.current = editorRef.current.innerHTML;
    setHasContent(content.trim().length > 0);
    onTextChange?.(content);
  }, [bindEmotionElement, buildTagElement, onTextChange]);

  return {
    editorRef,
    mentionMenuRef,
    focused,
    hasContent,
    hasTextSelection,
    mentionOpen,
    mentionQuery,
    mentionPos,
    mentionIndex,
    emotionMenuPosition: dubbingAdvancedEnabled ? emotionMenuPosition : null,
    emotionMenuSelectedEmotion,
    pauseMenuPosition,
    interjectionMenuPosition,
    handleInput,
    handleBeforeInput,
    handleKeyDown,
    handlePaste,
    handleEditorFocus,
    handleEditorBlur,
    handleRemoveFile,
    insertFromCard,
    insertMention,
    openEmotionMenu,
    openInlineMenu,
    openInlineMenuForTag,
    insertInlineTag,
    applyEmotion,
    getPromptSnapshot,
    clearContent,
    clearAdvancedContent,
    restoreContent,
    setMentionIndex,
  };
}
