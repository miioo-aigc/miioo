/** 图片/视频提示词适配：复用创作页编辑器，保留节点草稿并隔离画布事件。 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useViewport } from '@xyflow/react';
import CreationPromptEditor from '../creation/CreationPromptEditor';
import { useCreationPromptInteraction } from '../creation/useCreationPromptInteraction';
import { showGlobalToast } from '../../stores/toastStore';
import { getCanvasPromptFiles } from './CanvasPromptReferences';
import { validateCanvasVideoMedia } from './CanvasVideoGeneration';

export default function CanvasMediaPromptEditor({ nodeType, mode, model, capabilities, placeholder, references, prompt, snapshot, onChange, onFocusChange, onSend, composingRef }) {
  const files = getCanvasPromptFiles(references, nodeType, mode);
  const [prefillData] = useState(() => ({ prompt, promptHTML: snapshot?.html, files }));
  const { zoom } = useViewport();
  const canInsertMention = useCallback((file, replacingFileRef = '', editor) => {
    if (nodeType !== 'video') return true;
    const selectedIds = Array.from(editor?.querySelectorAll('[data-file-ref]') || [])
      .map((tag) => tag.dataset.fileRef)
      .filter((id) => id && id !== replacingFileRef);
    if (!selectedIds.includes(file._uid)) selectedIds.push(file._uid);
    const types = selectedIds.map((id) => files.find((item) => item._uid === id)?.asset_type).filter(Boolean);
    const validation = validateCanvasVideoMedia(types, capabilities, model, mode);
    if (!validation.allowed) showGlobalToast('warning', validation.message);
    return validation.allowed;
  }, [capabilities, files, mode, model, nodeType]);
  const editor = useCreationPromptInteraction({
    files, genType: nodeType, refMode: mode, prefillVersion: 1, prefillData,
    showToast: (type, message) => showGlobalToast(type, message),
    handleFileSelect: () => showGlobalToast('warning', '请通过添加按钮上传参考素材'),
    canInsertMention,
  });
  const { editorRef, getPromptSnapshot, restoreContent, handleInput } = editor;
  const latest = useRef(onChange);
  useEffect(() => { latest.current = onChange; });
  const lastText = useRef(prompt);
  const lastHtml = useRef(snapshot?.html);
  const sync = useCallback(() => {
    if (composingRef.current) return;
    const next = getPromptSnapshot();
    if (lastHtml.current === next.html && lastText.current === next.requestText) return;
    lastText.current = next.requestText;
    lastHtml.current = next.html;
    latest.current(next);
  }, [composingRef, getPromptSnapshot]);

  useEffect(() => {
    const observer = new MutationObserver(sync);
    observer.observe(editorRef.current, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [editorRef, sync]);

  useEffect(() => {
    if (composingRef.current || (prompt === lastText.current && snapshot?.html === lastHtml.current)) return;
    lastText.current = prompt;
    lastHtml.current = snapshot?.html;
    restoreContent({ text: prompt, html: snapshot?.html, restoreFiles: files });
  // 候选列表变化不应重建正文或重置光标。
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prompt, snapshot?.html, composingRef, restoreContent]);

  const fileIds = JSON.stringify(files.map((file) => file._uid));
  useEffect(() => {
    const ids = new Set(JSON.parse(fileIds));
    let changed = false;
    editorRef.current.querySelectorAll('[data-file-ref]').forEach((tag) => {
      if (!ids.has(tag.dataset.fileRef)) { tag.remove(); changed = true; }
    });
    if (changed) { handleInput(); sync(); }
  }, [fileIds, editorRef, handleInput, sync]);

  return <div className="canvas-media-prompt-editor"
    onCompositionStart={() => { composingRef.current = true; }}
    onCompositionEnd={() => { composingRef.current = false; editor.handleInput(); sync(); }}
    onKeyDown={(event) => event.stopPropagation()} onKeyUp={(event) => event.stopPropagation()}>
    <CreationPromptEditor
      editorRef={editorRef} files={files} genType={nodeType} refMode={mode} showFileCards={false}
      placeholderText={placeholder}
      hasContent={editor.hasContent}
      onInput={() => { if (!composingRef.current) { editor.handleInput(); sync(); } }}
      onBeforeInput={editor.handleBeforeInput} onPaste={editor.handlePaste}
      onKeyDown={(event) => editor.handleKeyDown(event, () => onSend(getPromptSnapshot()))}
      onFocus={() => { editor.handleEditorFocus(); onFocusChange(true); }}
      onBlur={() => { editor.handleEditorBlur(); onFocusChange(false); sync(); }}
      mentionOpen={editor.mentionOpen} mentionQuery={editor.mentionQuery}
      mentionPos={{ top: editor.mentionPos.top / zoom, left: editor.mentionPos.left / zoom }}
      mentionMenuRef={editor.mentionMenuRef} mentionIndex={editor.mentionIndex}
      onMentionSelect={(file) => { if (editor.insertMention(file)) sync(); }}
      onMentionIndexChange={editor.setMentionIndex}
    />
  </div>;
}
