import { useRef, useState } from 'react';
import CanvasNodeShell from './CanvasNodeShell';
import FileUploadButton from '../ui/FileUploadButton';
import { readCanvasTextFile } from './CanvasTextFileReader';
import CanvasTextResult from './CanvasTextResult';
import CanvasInlineTextEditor from './CanvasInlineTextEditor';
import { useCanvasTextOverflow } from './UseCanvasTextOverflow';
import { useCanvasTextWheel } from './UseCanvasTextWheel';

export default function TextCanvasNode({ id, data, selected }) {
  const [editing, setEditing] = useState(false);
  const [fileError, setFileError] = useState('');
  const contentRef = useRef(null);
  const fileInputRef = useRef(null);
  useCanvasTextOverflow(contentRef, editing);
  useCanvasTextWheel(contentRef);

  const handleDoubleClick = (event) => {
    if (event.target.closest('button, input')) return;
    event.stopPropagation();
    if (editing) return;
    data?.onCancelPendingClick?.(id);
    data?.onEnterEditing?.(id);
    setEditing(true);
  };
  const handleToolbarAction = (action) => {
    if (action === 'edit') {
      data?.onCancelPendingClick?.(id);
      data?.onEditContent?.(id);
      return;
    }
    if (!data?.content?.trim()) return;
    if (action === 'copy') {
      navigator.clipboard?.writeText(data?.content || '');
      return;
    }
    if (action === 'download') {
      const url = URL.createObjectURL(new Blob([data?.content || ''], { type: 'text/plain;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `${data?.label || '文本节点'}.txt`;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
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

  return <CanvasNodeShell nodeType="text" title={data?.label || '文本'} selected={selected} data={{ ...data, nodeId: id, editing, onToolbarAction: handleToolbarAction }} onPromptChange={data?.onPromptChange} onAddReference={data?.onAddReference} onGenerate={data?.onGenerate}>
    <div ref={contentRef} data-text-preview={!editing} className={`canvas-node__text-content ${editing ? 'nodrag nowheel nopan' : ''}`} onDoubleClick={handleDoubleClick}>
      {editing ? <CanvasInlineTextEditor
        initialContent={data?.content || ''}
        onContentChange={(content) => data?.onContentChange?.(id, content)}
        onFinish={() => setEditing(false)}
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
