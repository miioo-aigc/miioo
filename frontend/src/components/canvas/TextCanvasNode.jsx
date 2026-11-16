import { downloadCanvasText } from './CanvasTextDownload';
import { useRef, useState } from 'react';
import { NodeResizeControl } from '@xyflow/react';
import CanvasNodeShell from './CanvasNodeShell';
import FileUploadButton from '../ui/FileUploadButton';
import { getCanvasFileName } from './CanvasFileName';
import { readCanvasTextFile } from './CanvasTextFileReader';
import CanvasTextResult from './CanvasTextResult';
import CanvasInlineTextEditor from './CanvasInlineTextEditor';
import { useCanvasTextOverflow } from './UseCanvasTextOverflow';
import { useCanvasTextWheel } from './UseCanvasTextWheel';

export default function TextCanvasNode({ id, data, selected, width, height }) {
  const [editing, setEditing] = useState(false);
  const [fileError, setFileError] = useState('');
  const contentRef = useRef(null);
  const fileInputRef = useRef(null);
  useCanvasTextOverflow(contentRef, editing);
  useCanvasTextWheel(contentRef, selected);

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
      downloadCanvasText(data);
    }
  };
  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setFileError('');
    try {
      data?.onContentChange?.(id, await readCanvasTextFile(file));
      const name = getCanvasFileName(file.name);
      if (name) data?.onRename?.(name);
    } catch (error) {
      setFileError(`文档读取失败：${error?.message || '请重新选择文件'}`);
      data?.onFileError?.(error);
    }
  };

  return <>
    {selected && !data?.submissionLocked && <NodeResizeControl nodeId={id} position="bottom-right" minWidth={180} minHeight={144} className="canvas-text-resize nodrag nopan" style={{ background: 'transparent', border: 0, width: 20, height: 20 }}><svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M4 11 11 4M8 11l3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg></NodeResizeControl>}
    <CanvasNodeShell nodeType="text" title={data?.label || '文本'} selected={selected} data={{ ...data, nodeId: id, textWidth: width || 240, textHeight: (height || 264) - 24, editing, onToolbarAction: handleToolbarAction }} onPromptChange={data?.onPromptChange} onAddReference={data?.onAddReference} onGenerate={data?.onGenerate}>
    <div ref={contentRef} data-text-preview={!editing} data-scroll-enabled={Boolean(selected)} className={`canvas-node__text-content ${editing ? 'nodrag nowheel nopan' : ''}`} onDoubleClick={handleDoubleClick}>
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
  </CanvasNodeShell></>;
}
