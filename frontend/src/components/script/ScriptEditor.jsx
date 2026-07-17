import { useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import Heading from '@tiptap/extension-heading';
import Bold from '@tiptap/extension-bold';
import BulletList from '@tiptap/extension-bullet-list';
import OrderedList from '@tiptap/extension-ordered-list';
import ListItem from '@tiptap/extension-list-item';
import { Markdown } from 'tiptap-markdown';
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
    extensions: [
      Document,
      Paragraph,
      Text,
      Heading.configure({ levels: [1, 2] }),
      Bold,
      BulletList,
      OrderedList,
      ListItem,
      Markdown.configure({ html: false, transformCopiedText: true, transformPastedText: true }),
    ],
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
