/** 文本节点专注编辑：草稿只在保存时提交，原生模态隔离画布和键盘焦点。 */
import { useEffect, useRef, useState } from 'react';
import ScriptEditor from '../script/ScriptEditor';
import { Button } from '../ui';

export default function CanvasTextEditor({ title, content, onCancel, onSave }) {
  const [draft, setDraft] = useState(content || '');
  const dialogRef = useRef(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    dialog.showModal();
    return () => {
      dialog.close();
      if (previousFocus?.isConnected) previousFocus.focus?.();
    };
  }, []);

  return <dialog ref={dialogRef} role="dialog" aria-modal="true" aria-label={`编辑内容：${title}`}
    className="m-auto h-[800px] max-h-[calc(100dvh-32px)] w-[800px] max-w-[calc(100vw-32px)] overflow-hidden rounded-large border border-stroke-normal bg-surface-modal p-0 text-text-primary backdrop:bg-transparent"
    onCancel={(event) => event.preventDefault()}
    onKeyDown={(event) => event.stopPropagation()} onKeyUp={(event) => event.stopPropagation()}
    onWheel={(event) => event.stopPropagation()} onContextMenu={(event) => event.stopPropagation()}>
    <div className="flex h-full min-h-0 flex-col gap-[16px] p-[24px]">
      <h2 className="m-0 shrink-0 truncate text-font-size-16 font-font-weight-medium">{title} · 编辑内容</h2>
      <ScriptEditor initialContent={content} onContentChange={setDraft} />
      <div className="flex shrink-0 justify-end gap-[12px]">
        <Button variant="secondary" onClick={onCancel}>取消</Button>
        <Button variant="primary" onClick={() => onSave(draft)}>保存</Button>
      </div>
    </div>
  </dialog>;
}
