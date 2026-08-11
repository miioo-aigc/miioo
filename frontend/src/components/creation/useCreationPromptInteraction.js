/**
 * @file useCreationPromptInteraction.js
 * @structure-index
 *
 * ─── 纯函数与 DOM 标签构造 ───────────────────────────── L26–L117
 *   FONT、formatMentionLabel()、handleTagClick()、buildTagElement()
 *
 * ─── 提示词编辑生命周期 ─────────────────────────────── L119–L155
 *   预填充 HTML/文本、重建 @素材标签、@菜单 outside click
 *
 * ─── 输入事件与素材标签操作 ─────────────────────────── L157–L387
 *   粘贴处理、文件移除、卡片插入、@菜单选择、键盘删除/提交
 *
 * ─── 快照与恢复接口 ─────────────────────────────────── L389–L420
 *   getPromptSnapshot()、clearContent()、restoreContent()
 *
 * ─── 公开 Hook 接口 ──────────────────────────────────── L422–L444
 *   编辑器 ref、焦点/内容状态、事件回调、快照与恢复能力
 *
 * ─── 边界说明 ─────────────────────────────────────────
 *   本 Hook 只管理 contentEditable 和 @素材标签 DOM；文件列表、参数状态、生成 API、任务轮询、缓存和 Store 仍由 InputCard/CreationPage 持有。
 */

import { useCallback, useEffect, useRef, useState } from 'react';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif";

function formatMentionLabel(name = '') {
  const dotIdx = name.lastIndexOf('.');
  if (dotIdx === -1) return name.length > 9 ? `${name.slice(0, 9)}…` : name;
  const base = name.slice(0, dotIdx);
  const ext = name.slice(dotIdx);
  const truncatedBase = base.length > 9 ? `${base.slice(0, 9)}…` : base;
  return truncatedBase + ext;
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
}) {
  const [focused, setFocused] = useState(false);
  const [hasContent, setHasContent] = useState(false);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionPos, setMentionPos] = useState({ top: 0, left: 0 });
  const [mentionAnchorRange, setMentionAnchorRange] = useState(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionTargetTag, setMentionTargetTag] = useState(null);
  const editorRef = useRef(null);
  const mentionMenuRef = useRef(null);
  const mentionFromTagRef = useRef(false);
  const savedCursorRangeRef = useRef(null);

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
      const content = editorRef.current?.innerText ?? '';
      setHasContent(content.trim().length > 0);
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
          const file = filesToUse.find((item) => (item._uid || item.name) === fileRef)
            || { name: fileRef, url: '', size: 0, _uid: fileRef };
          const newTag = buildTagElement(file);
          oldTag.parentNode?.replaceChild(newTag, oldTag);
        });
      } else if (prefillData.prompt) {
        editorRef.current.textContent = prefillData.prompt;
      }
      // 这里同步 React 状态与手动维护的 contentEditable DOM；触发信号由 prefillVersion 控制。
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHasContent((prefillData.prompt || '').trim().length > 0);
    }
  // prefillVersion 是外部约定的唯一触发信号，不能因 prefillData 对象重建而重复覆盖编辑器内容。
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildTagElement, prefillVersion]);

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
    if (text) document.execCommand('insertText', false, text);
  }, [genType, handleFileSelect, refMode, showToast]);

  const handleRemoveFile = useCallback((index) => {
    const file = files[index];
    removeFile(index);
    if (file && editorRef.current) {
      editorRef.current.querySelectorAll('[data-file-ref]').forEach((tag) => {
        if (tag.dataset.fileRef === (file._uid || file.name)) tag.remove();
      });
      const content = editorRef.current.innerText ?? '';
      setHasContent(content.trim().length > 0);
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
    const content = editorRef.current?.innerText ?? '';
    setHasContent(content.trim().length > 0);
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
  }, []);

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
        const content = editorRef.current?.innerText ?? '';
        setHasContent(content.trim().length > 0);
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
    clone.querySelectorAll('[data-file-ref]').forEach((element) => element.remove());
    return {
      text: clone.innerText?.trim() ?? '',
      html: editorRef.current.innerHTML ?? '',
    };
  }, []);

  const clearContent = useCallback(() => {
    if (editorRef.current) editorRef.current.innerHTML = '';
    setHasContent(false);
  }, []);

  const restoreContent = useCallback(({ html = '', text = '', fallback = '', restoreFiles = [] } = {}) => {
    if (!editorRef.current) return;
    if (html) {
      editorRef.current.innerHTML = html;
      Array.from(editorRef.current.querySelectorAll('[data-file-ref]')).forEach((oldTag) => {
        const fileRef = oldTag.dataset.fileRef;
        const file = restoreFiles.find((item) => (item._uid || item.name) === fileRef)
          || { name: fileRef, url: '', size: 0, _uid: fileRef };
        oldTag.parentNode?.replaceChild(buildTagElement(file), oldTag);
      });
      setHasContent(true);
      return;
    }
    const content = text || fallback;
    editorRef.current.innerText = content;
    setHasContent(content.trim().length > 0);
  }, [buildTagElement]);

  return {
    editorRef,
    mentionMenuRef,
    focused,
    hasContent,
    mentionOpen,
    mentionQuery,
    mentionPos,
    mentionIndex,
    handleInput,
    handleKeyDown,
    handlePaste,
    handleEditorFocus,
    handleEditorBlur,
    handleRemoveFile,
    insertFromCard,
    insertMention,
    getPromptSnapshot,
    clearContent,
    restoreContent,
    setMentionIndex,
  };
}
