/** 卡片内富文本编辑：沿用预览排版，不随节点回传重置输入。 */
import { useCallback, useEffect, useRef } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import { createCanvasTextEditorExtensions } from './CanvasTextEditorExtensions';

export default function CanvasInlineTextEditor({ initialContent, onContentChange, onFinish }) {
  const containerRef = useRef(null);
  const callbacksRef = useRef({ onContentChange, onFinish });
  const lastContentRef = useRef(initialContent);
  const dirtyRef = useRef(false);
  const composingRef = useRef(false);
  const finishedRef = useRef(false);
  useEffect(() => { callbacksRef.current = { onContentChange, onFinish }; });

  const commit = useCallback((currentEditor) => {
    if (!dirtyRef.current || currentEditor.isDestroyed) return;
    const content = currentEditor.storage.markdown.getMarkdown();
    if (content !== lastContentRef.current) {
      lastContentRef.current = content;
      callbacksRef.current.onContentChange(content);
    }
  }, []);
  const finish = useCallback((currentEditor) => {
    if (finishedRef.current) return;
    commit(currentEditor);
    finishedRef.current = true;
    callbacksRef.current.onFinish();
  }, [commit]);
  const editor = useEditor({
    extensions: createCanvasTextEditorExtensions(),
    content: initialContent,
    parseOptions: { preserveWhitespace: 'full' },
    immediatelyRender: false,
    autofocus: true,
    editorProps: { attributes: { role: 'textbox', 'aria-label': '文本节点正文', 'aria-multiline': 'true' } },
    onUpdate: ({ editor: currentEditor }) => {
      dirtyRef.current = true;
      if (!composingRef.current && !currentEditor.view.composing) commit(currentEditor);
    },
    onBlur: ({ editor: currentEditor }) => {
      window.setTimeout(() => finish(currentEditor), 0);
    },
  });

  useEffect(() => {
    if (!editor) return;
    const outside = (event) => {
      if (!containerRef.current?.contains(event.target)) editor.commands.blur();
    };
    document.addEventListener('pointerdown', outside, true);
    return () => document.removeEventListener('pointerdown', outside, true);
  }, [editor, finish]);

  return <div ref={containerRef} className="canvas-node__inline-editor canvas-node__rich-text nodrag nowheel nopan"
    onKeyDown={(event) => event.stopPropagation()} onKeyUp={(event) => event.stopPropagation()}
    onCompositionStart={() => { composingRef.current = true; }}
    onCompositionEnd={() => {
      composingRef.current = false;
      window.setTimeout(() => { if (editor && !finishedRef.current) commit(editor); }, 0);
    }}>
    <EditorContent editor={editor} />
  </div>;
}
