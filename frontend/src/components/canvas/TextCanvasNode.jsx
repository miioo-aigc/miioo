import { useEffect, useRef, useState } from 'react';
import CanvasNodeShell from './CanvasNodeShell';
import FileUploadButton from '../ui/FileUploadButton';
import { readCanvasTextFile } from './CanvasTextFileReader';
import CanvasTextResult from './CanvasTextResult';

export default function TextCanvasNode({ id, data, selected }) {
  const [editing, setEditing] = useState(false);
  const [fileError, setFileError] = useState('');
  const contentRef = useRef(null);
  const editorRef = useRef(null);
  const fileInputRef = useRef(null);
  const composingRef = useRef(false);
  const contentChangeRef = useRef(data?.onContentChange);

  useEffect(() => {
    contentChangeRef.current = data?.onContentChange;
  }, [data?.onContentChange]);

  useEffect(() => {
    if (!editing) return;
    editorRef.current?.focus();
    const handleOutsidePointer = (event) => {
      if (!contentRef.current?.contains(event.target)) {
        contentChangeRef.current?.(id, editorRef.current?.value ?? '');
        composingRef.current = false;
        setEditing(false);
      }
    };
    document.addEventListener('pointerdown', handleOutsidePointer, true);
    return () => document.removeEventListener('pointerdown', handleOutsidePointer, true);
  }, [editing, id]);

  const handleContentChange = (event) => {
    if (composingRef.current || event.nativeEvent?.isComposing) return;
    data?.onContentChange?.(id, event.currentTarget.value);
  };
  const handleCompositionEnd = (event) => {
    composingRef.current = false;
    data?.onContentChange?.(id, event.currentTarget.value);
  };
  const handleBlur = (event) => {
    composingRef.current = false;
    data?.onContentChange?.(id, event.currentTarget.value);
    setEditing(false);
  };

  const handleDoubleClick = (event) => {
    if (event.target.closest('button, input')) return;
    event.stopPropagation();
    data?.onCancelPendingClick?.(id);
    data?.onEnterEditing?.(id);
    setEditing(true);
  };
  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setFileError('');
    try {
      data?.onContentChange?.(id, await readCanvasTextFile(file));
    } catch (error) {
      setFileError(`文档读取失败：${error?.message || '请重新选择文件'}`);
      data?.onFileError?.(error);
    }
  };

  return <CanvasNodeShell nodeType="text" title={data?.label || '文本'} selected={selected} data={{ ...data, nodeId: id, editing }} onPromptChange={data?.onPromptChange} onAddReference={data?.onAddReference} onGenerate={data?.onGenerate}>
    <div ref={contentRef} className={`canvas-node__text-content ${editing ? 'nodrag nowheel nopan' : data?.content ? 'nowheel' : ''}`} onDoubleClick={handleDoubleClick}>
      {editing ? <textarea
        ref={editorRef}
        className="canvas-node__text-editor nodrag nowheel nopan"
        aria-label="文本节点正文"
        // 编辑期间由浏览器维护正文，避免画布数据回传重置输入法的组合文本。
        defaultValue={data?.content || ''}
        onChange={handleContentChange}
        onCompositionStart={() => { composingRef.current = true; }}
        onCompositionEnd={handleCompositionEnd}
        onBlur={handleBlur}
        onKeyDown={(event) => event.stopPropagation()}
        onKeyUp={(event) => event.stopPropagation()}
      /> : !data?.content && <>
        <span className="canvas-node__text-placeholder">双击编辑</span>
        <FileUploadButton className="canvas-node__upload nodrag nopan" onClick={() => fileInputRef.current?.click()}>本地上传</FileUploadButton>
        <input ref={fileInputRef} type="file" hidden onChange={handleFileChange} />
        <span className="canvas-node__upload-hint">支持.docx/.txt/.md</span>
      </>}
      <CanvasTextResult content={data?.content} generating={data?.generating} editing={editing} />
      {fileError && <span role="alert" className="canvas-node__upload-error">{fileError}</span>}
    </div>
  </CanvasNodeShell>;
}
