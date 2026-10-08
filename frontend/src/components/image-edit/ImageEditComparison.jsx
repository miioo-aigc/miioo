import { useEffect, useRef, useState } from 'react';
import LoadingAnimation from '../LoadingAnimation';
import DotsLoading from '../DotsLoading';
import Button from '../ui/Button';
import { clampComparisonView, INITIAL_COMPARISON_VIEW, zoomComparisonView } from './ComparisonView';
import './ImageEditComparison.css';

export function ComparisonImage({ src, alt, view, onViewChange }) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const stageRef = useRef(null);
  const dragRef = useRef(null);
  const zoom = view?.zoom || 1;
  useEffect(() => {
    const stage = stageRef.current;
    if (!onViewChange || !loaded || failed) return;
    function wheel(event) {
      event.preventDefault();
      event.stopPropagation();
      const rect = stage.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? rect.height : 1);
      const anchor = { x: (event.clientX - rect.left) / rect.width - 0.5, y: (event.clientY - rect.top) / rect.height - 0.5 };
      onViewChange((previous) => zoomComparisonView(previous, delta, anchor));
    }
    stage.addEventListener('wheel', wheel, { passive: false });
    return () => stage.removeEventListener('wheel', wheel);
  }, [onViewChange, loaded, failed]);

  function move(event) {
    if (!onViewChange || !dragRef.current || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dx = (event.clientX - dragRef.current.x) / rect.width;
    const dy = (event.clientY - dragRef.current.y) / rect.height;
    dragRef.current = { x: event.clientX, y: event.clientY };
    onViewChange((previous) => clampComparisonView({ ...previous, x: previous.x + dx, y: previous.y + dy }));
  }
  function endDrag(event) {
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }
  return <div ref={stageRef} className={`edit-comparison-image${onViewChange && zoom > 1 ? ' is-zoomed' : ''}`} onPointerDown={(event) => {
    if (onViewChange && loaded && !failed && zoom > 1 && event.button === 0) {
      event.preventDefault();
      dragRef.current = { x: event.clientX, y: event.clientY };
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  }} onPointerMove={move} onPointerUp={endDrag} onPointerCancel={endDrag} onLostPointerCapture={() => { dragRef.current = null; }}
  onDoubleClick={() => onViewChange?.({ ...INITIAL_COMPARISON_VIEW })}>
    {!failed && <img key={attempt} src={src} alt={alt} draggable={false} onLoad={() => setLoaded(true)} onError={() => setFailed(true)} style={{ transform: `translate(${(view?.x || 0) * 100}%, ${(view?.y || 0) * 100}%) scale(${zoom})`, transformOrigin: 'center' }} />}
    {!loaded && !failed && <div className="edit-comparison-message" role="status" aria-label="图片加载中"><DotsLoading /></div>}
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
      {busy && <div className="edit-comparison-message is-overlay" role="status" aria-label="生成处理中"><LoadingAnimation width={88} /></div>}
      {!busy && error && <div className="edit-comparison-message is-overlay" role="alert"><span>{error}</span>{retrySave && <Button size="small" onClick={onRetry}>重试任务保存</Button>}</div>}
    </div>
  </div>;
}
