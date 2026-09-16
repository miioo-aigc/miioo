import { useMemo, useRef, useState } from 'react';
import ImageEditChrome, { ImageEditFooter } from './ImageEditChrome';
import InpaintToolbar from './InpaintToolbar';
import InpaintStage from './InpaintStage';
import TextField from '../ui/TextField';
import { showGlobalToast } from '../../stores/toastStore';
import './Inpaint.css';
import useImageEditSubmission from '../../hooks/useImageEditSubmission';

export default function InpaintModal({ card, onClose, onSave, onComplete = onClose, mode = 'inpaint' }) {
  const { busy, submit: generate } = useImageEditSubmission({ card, onSave, onComplete });
  const isEraser = mode === 'eraser';
  const [tool, setTool] = useState('brush');
  const [brushSize, setBrushSize] = useState(50);
  const [zoom, setZoom] = useState(100);
  const [prompt, setPrompt] = useState('');
  const [history, setHistory] = useState({ strokes: [], index: 0 });
  const [ready, setReady] = useState(false);
  const [revision, setRevision] = useState(0);
  const editor = useRef(null);
  const strokes = useMemo(() => history.strokes.slice(0, history.index), [history]);

  function reset() {
    setTool('brush');
    setBrushSize(50);
    setZoom(100);
    setPrompt('');
    setHistory({ strokes: [], index: 0 });
    setReady(false);
    setRevision((value) => value + 1);
  }

  function addStroke(stroke) {
    setHistory((previous) => {
      const next = [...previous.strokes.slice(0, previous.index), stroke];
      return { strokes: next, index: next.length };
    });
  }

  function submit() {
    const mask = editor.current?.exportMask();
    if (!mask) {
      showGlobalToast(isEraser ? '请先涂抹需要消除的区域' : '请先涂抹需要重绘的区域', 'error');
      return;
    }
    if (!isEraser && !prompt.trim()) {
      showGlobalToast('请输入重绘提示词', 'error');
      return;
    }
    if (prompt.length > 4000) { showGlobalToast('提示词不能超过4000字', 'error'); return; }
    generate({ mode: isEraser ? 'erase' : 'inpaint', mask, model_requirement: 'image-2', ...(!isEraser ? { prompt: prompt.trim() } : {}) });
  }

  return (
    <ImageEditChrome title={isEraser ? '消除笔' : '局部重绘'} onClose={onClose} busy={busy} footer={<ImageEditFooter onReset={reset} onClose={onClose} onSubmit={submit} busy={busy} disabled={!ready} label="AI生成" />}>
      <div className="inpaint-body" inert={busy}>
        <InpaintToolbar tool={tool} onToolChange={setTool} brushSize={brushSize} onBrushSizeChange={setBrushSize} zoom={zoom} onZoomChange={setZoom} canUndo={history.index > 0} canRedo={history.index < history.strokes.length} onUndo={() => setHistory((value) => ({ ...value, index: Math.max(0, value.index - 1) }))} onRedo={() => setHistory((value) => ({ ...value, index: Math.min(value.strokes.length, value.index + 1) }))} disabled={!ready} />
        <InpaintStage key={`${card.imageUrl}-${revision}`} imageUrl={card.originalUrl || card.original_url || card.download_url || card.downloadUrl || card.imageUrl} tool={tool} brushSize={brushSize} zoom={zoom} strokes={strokes} onStroke={addStroke} onReady={setReady} editorRef={editor} />
        {!isEraser && <div className="inpaint-prompt">
          <TextField multiline height="72px" wrapperStyle={{ width: '100%' }} aria-label="重绘提示词" placeholder="请描述想要重新绘制的内容" value={prompt} onChange={(event) => setPrompt(event.target.value)} />
        </div>}
      </div>
    </ImageEditChrome>
  );
}
