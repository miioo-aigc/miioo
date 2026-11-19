import { useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { createScriptEditorExtensions } from './ScriptEditorExtensions';
import EditorToolbar from './EditorToolbar';
import { EditorHistory } from './EditorHistory';
import { ensureScriptEditorStyle } from './ScriptStyles';

export default function ScriptEditor({ initialContent, onContentChange, containerRef, historyDepth = 0, autoFocus = false }) {
  useEffect(() => {
    ensureScriptEditorStyle();
  }, []);

  const onContentChangeRef = useRef(onContentChange);
  useEffect(() => {
    onContentChangeRef.current = onContentChange;
  });

  const editor = useEditor({
    extensions: [...createScriptEditorExtensions(), ...(historyDepth > 0 ? [EditorHistory.configure({ depth: historyDepth })] : [])],
    content: initialContent || '',
    immediatelyRender: false,
    onUpdate: ({ editor: currentEditor }) => {
      onContentChangeRef.current?.(currentEditor.storage.markdown.getMarkdown());
    },
  });

  useEffect(() => {
    if (!autoFocus || !editor) return undefined;
    // 等待正文挂载及父级模态框打开后再聚焦，避免焦点被 showModal 接管。
    const frame = window.requestAnimationFrame(() => {
      if (!editor.isDestroyed) editor.commands.focus('end', { scrollIntoView: false });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [autoFocus, editor]);

  return (
    <div style={{ alignSelf: 'stretch', display: 'flex', flex: 1, minHeight: 0, flexDirection: 'column', gap: '12px', overflow: 'hidden' }}>
      <EditorToolbar editor={editor} />
      <div
        ref={containerRef}
        className="tiptap-editor"
        style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: '4px' }}
      >
        <EditorContent editor={editor} style={{ width: '100%' }} />
      </div>
    </div>
  );
}
