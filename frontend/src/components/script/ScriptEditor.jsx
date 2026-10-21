import { useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { createScriptEditorExtensions } from './ScriptEditorExtensions';
import EditorToolbar from './EditorToolbar';
import { ensureScriptEditorStyle } from './ScriptStyles';

export default function ScriptEditor({ initialContent, onContentChange, containerRef }) {
  useEffect(() => {
    ensureScriptEditorStyle();
  }, []);

  const onContentChangeRef = useRef(onContentChange);
  useEffect(() => {
    onContentChangeRef.current = onContentChange;
  });

  const editor = useEditor({
    extensions: createScriptEditorExtensions(),
    content: initialContent || '',
    immediatelyRender: false,
    onUpdate: ({ editor: currentEditor }) => {
      onContentChangeRef.current?.(currentEditor.storage.markdown.getMarkdown());
    },
  });

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
