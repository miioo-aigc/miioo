import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useStoreApi } from '@xyflow/react';
import { ArrowLeftRight } from 'lucide-react';
import { DropdownMenu, IconButton, Tooltip } from '../ui';
import CanvasLocalUpload from './CanvasLocalUpload';

export default function CanvasNodeReplaceControl({ data, nodeType, disabled }) {
  const store = useStoreApi();
  const [open, setOpen] = useState(false);
  const [uploadPending, setUploadPending] = useState(false);
  const inputRef = useRef(null);
  const triggerRef = useRef(null);
  const [anchor, setAnchor] = useState({ left: 8, top: 8 });
  const latest = useRef({ data, disabled, uploadPending });
  useEffect(() => { latest.current = { data, disabled, uploadPending }; });
  const locked = disabled || Boolean(data?.submissionLocked) || uploadPending;
  const visible = open && !locked;
  useEffect(() => {
    if (!visible) return undefined;
    const readAnchor = state => {
      const position = state.nodeLookup.get(data?.nodeId)?.internals.positionAbsolute;
      return [...state.transform, position?.x, position?.y];
    };
    const initial = readAnchor(store.getState());
    return store.subscribe(state => {
      if (readAnchor(state).some((value, index) => value !== initial[index])) setOpen(false);
    });
  }, [data?.nodeId, store, visible]);
  const upload = async assets => {
    const current = latest.current;
    if (current.disabled || current.data?.submissionLocked || current.data?.generationPending || current.data?.outputLocked
      || current.data?.asset?.uploadStatus === 'uploading' || current.data?.pendingCanvasUpload?.asset?.uploadStatus === 'uploading'
      || current.uploadPending) return false;
    setUploadPending(true);
    try {
      return await current.data?.onAssetChange?.(current.data.nodeId, assets, { purpose: 'replace', nodeType });
    } finally {
      setUploadPending(false);
    }
  };
  return <div className="canvas-node-result-replace nodrag nopan" onPointerDown={event => event.stopPropagation()} onMouseDown={event => event.stopPropagation()} onClick={event => event.stopPropagation()}>
    <Tooltip label="替换">
      <span><IconButton ref={triggerRef} aria-label="替换" title="替换" disabled={locked} aria-expanded={visible}
        variant="secondary" style={{ paddingTop: 8, paddingBottom: 8, alignSelf: 'auto', height: 'auto', width: 32,
          boxShadow: 'none', backgroundColor: 'transparent',
          backgroundImage: 'linear-gradient(rgba(0, 0, 0, 0.8), rgba(0, 0, 0, 0.8))' }}
        className="canvas-node-result-controls__trigger" onClick={() => {
          if (locked) return;
          if (open) { setOpen(false); return; }
          const rect = triggerRef.current?.getBoundingClientRect();
          if (rect) setAnchor({ left: Math.max(8, Math.min(rect.right, window.innerWidth - 200)), top: Math.max(8, Math.min(rect.top, window.innerHeight - 90)) });
          setOpen(true);
        }}>
        <ArrowLeftRight size={16} aria-hidden="true" />
      </IconButton></span>
    </Tooltip>
    {visible && createPortal(<DropdownMenu className="canvas-node-replace__menu" width="max-content" onClose={() => setOpen(false)}
      style={{ position: 'fixed', bottom: 'auto', right: 'auto', marginTop: 0, marginBottom: 0,
        left: anchor.left, top: anchor.top, zIndex: 110 }}
      items={[
        { key: 'local', label: '从本地上传', disabled: locked, onClick: () => {
          setOpen(false);
          if (!locked) inputRef.current?.click();
        } },
        { key: 'library', label: '从资产库选择', disabled: locked, onClick: () => {
          setOpen(false);
          const current = latest.current;
          if (!current.disabled && !current.data?.submissionLocked && !current.data?.generationPending
            && !current.data?.outputLocked && current.data?.asset?.uploadStatus !== 'uploading'
            && current.data?.pendingCanvasUpload?.asset?.uploadStatus !== 'uploading' && !current.uploadPending) {
            current.data?.onSelectAsset?.(current.data.nodeId, nodeType, { purpose: 'replace' });
          }
        } },
      ]} />, document.body)}
    <CanvasLocalUpload nodeType={nodeType} trigger={false} multiple={false} purpose="replace" disabled={locked} inputElementRef={inputRef} onAssetChange={upload} />
  </div>;
}
