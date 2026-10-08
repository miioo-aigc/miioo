import { useState } from 'react';
import { LoaderCircle, Maximize, ZoomIn, ZoomOut } from 'lucide-react';
import IconButton from '../ui/IconButton';
import Button from '../ui/Button';
import './ImageEditComparison.css';

export function ComparisonImage({ src, alt, view, onViewChange }) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const zoom = view?.zoom || 1;
  function move(event) {
    if (!onViewChange || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const rect = event.currentTarget.getBoundingClientRect();
    onViewChange((previous) => ({ ...previous,
      x: Math.max(-0.5, Math.min(0.5, (event.clientX - rect.left) / rect.width - 0.5)),
      y: Math.max(-0.5, Math.min(0.5, (event.clientY - rect.top) / rect.height - 0.5)),
    }));
  }
  return <div className="edit-comparison-image" onPointerDown={(event) => {
    if (onViewChange && event.button === 0) { event.currentTarget.setPointerCapture(event.pointerId); move(event); }
  }} onPointerMove={move} onPointerUp={(event) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }}>
    {!failed && <img key={attempt} src={src} alt={alt} draggable={false} onLoad={() => setLoaded(true)} onError={() => setFailed(true)} style={{ transform: `scale(${zoom})`, transformOrigin: `${50 + (view?.x || 0) * 100}% ${50 + (view?.y || 0) * 100}%` }} />}
    {!loaded && !failed && <span className="edit-comparison-message" role="status">图片加载中…</span>}
    {failed && <div className="edit-comparison-message" role="alert">图片加载失败<Button size="small" onClick={() => { setFailed(false); setLoaded(false); setAttempt((value) => value + 1); }}>重新加载</Button></div>}
  </div>;
}

export default function ImageEditComparison({ children, comparison, busy, onRetry, view, onViewChange }) {
  const { active, result, error, retrySave } = comparison;
  const url = result?.originalUrl || result?.remoteUrl || result?.imageUrl;
  return <div className={`edit-comparison${active ? ' is-active' : ''}`}>
    <div className="edit-comparison-source" inert={busy}>
      {children}
      {active && <span className="edit-comparison-label">原图</span>}
    </div>
    <div className="edit-comparison-result" inert={!active} aria-hidden={!active}>
      {url && <ComparisonImage key={url} src={url} alt="生成结果" view={view} onViewChange={onViewChange} />}
      <span className="edit-comparison-label">生成结果</span>
      {busy && <div className="edit-comparison-message is-overlay" role="status"><LoaderCircle className="edit-comparison-spinner" size={24} />生成处理中…</div>}
      {!busy && error && <div className="edit-comparison-message is-overlay" role="alert"><span>{error}</span>{retrySave && <Button size="small" onClick={onRetry}>重试任务保存</Button>}</div>}
    </div>
    {active && onViewChange && <div className="edit-comparison-zoom" role="group" aria-label="同步缩放对比图">
      <IconButton title="缩小" aria-label="缩小" icon={<ZoomOut size={16} />} disabled={view.zoom <= 1} onClick={() => onViewChange((value) => ({ ...value, zoom: Math.max(1, value.zoom - 0.5) }))} />
      <output>{Math.round(view.zoom * 100)}%</output>
      <IconButton title="放大" aria-label="放大" icon={<ZoomIn size={16} />} disabled={view.zoom >= 8} onClick={() => onViewChange((value) => ({ ...value, zoom: Math.min(8, value.zoom + 0.5) }))} />
      <IconButton title="适应窗口" aria-label="适应窗口" icon={<Maximize size={16} />} onClick={() => onViewChange({ zoom: 1, x: 0, y: 0 })} />
    </div>}
  </div>;
}
