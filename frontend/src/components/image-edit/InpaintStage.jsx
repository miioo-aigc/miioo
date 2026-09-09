import { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';

// 蒙版独立于原图，避免远程图片跨域污染；笔画始终使用原图像素坐标。
function paintStroke(context, stroke) {
  context.globalCompositeOperation = stroke.tool === 'eraser' ? 'destination-out' : 'source-over';
  context.fillStyle = '#fff';
  context.strokeStyle = '#fff';
  context.lineWidth = stroke.size;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.beginPath();
  context.arc(stroke.points[0].x, stroke.points[0].y, stroke.size / 2, 0, Math.PI * 2);
  context.fill();
  if (stroke.points.length < 2) return;
  context.beginPath();
  context.moveTo(stroke.points[0].x, stroke.points[0].y);
  stroke.points.slice(1).forEach((point) => context.lineTo(point.x, point.y));
  context.stroke();
}

export default function InpaintStage({ imageUrl, tool, brushSize, zoom, strokes, onStroke, onReady, editorRef }) {
  const viewport = useRef(null);
  const image = useRef(null);
  const canvas = useRef(null);
  const mask = useRef(null);
  const gesture = useRef(null);
  const [imageSize, setImageSize] = useState(null);
  const [area, setArea] = useState({ width: 1, height: 1 });
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [cursor, setCursor] = useState(null);
  const [failed, setFailed] = useState(false);
  const fit = imageSize ? Math.min(area.width / imageSize.width, area.height / imageSize.height) : 1;
  const displayScale = fit * zoom / 100;

  const renderMask = useCallback((currentStroke) => {
    if (!mask.current || !canvas.current) return;
    const source = mask.current;
    const context = source.getContext('2d');
    context.clearRect(0, 0, source.width, source.height);
    strokes.forEach((stroke) => paintStroke(context, stroke));
    if (currentStroke) paintStroke(context, currentStroke);
    const preview = canvas.current.getContext('2d');
    preview.clearRect(0, 0, source.width, source.height);
    preview.globalCompositeOperation = 'source-over';
    preview.drawImage(source, 0, 0);
    preview.globalCompositeOperation = 'source-in';
    preview.fillStyle = getComputedStyle(viewport.current).getPropertyValue('--color-brand-main').trim() || '#2dc3e1';
    preview.fillRect(0, 0, source.width, source.height);
    preview.globalCompositeOperation = 'source-over';
  }, [strokes]);

  useEffect(() => {
    const element = viewport.current;
    const observer = new ResizeObserver(() => setArea({ width: element.clientWidth, height: element.clientHeight }));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!imageSize) return;
    const source = document.createElement('canvas');
    source.width = imageSize.width;
    source.height = imageSize.height;
    mask.current = source;
    return () => { mask.current = null; };
  }, [imageSize]);

  useEffect(() => {
    renderMask(gesture.current?.tool !== 'move' ? gesture.current : null);
  }, [renderMask, imageSize]);

  useImperativeHandle(editorRef, () => ({
    exportMask() {
      if (!mask.current) return null;
      const source = mask.current;
      const pixels = source.getContext('2d').getImageData(0, 0, source.width, source.height).data;
      if (!pixels.some((value, index) => index % 4 === 3 && value > 0)) return null;
      const output = document.createElement('canvas');
      output.width = source.width;
      output.height = source.height;
      const context = output.getContext('2d');
      context.fillStyle = '#000';
      context.fillRect(0, 0, output.width, output.height);
      context.drawImage(source, 0, 0);
      return output.toDataURL('image/png');
    },
  }));

  function position(event) {
    const rect = canvas.current.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * imageSize.width / rect.width, y: (event.clientY - rect.top) * imageSize.height / rect.height };
  }

  function updateCursor(event) {
    const rect = viewport.current.getBoundingClientRect();
    const scale = rect.width / viewport.current.clientWidth;
    setCursor({ x: (event.clientX - rect.left) / scale, y: (event.clientY - rect.top) / scale });
  }

  function start(event) {
    if (!imageSize || failed || event.button !== 0 || gesture.current) return;
    const point = position(event);
    if (tool !== 'move' && (point.x < 0 || point.y < 0 || point.x > imageSize.width || point.y > imageSize.height)) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const scale = viewport.current.getBoundingClientRect().width / viewport.current.clientWidth;
    gesture.current = tool === 'move'
      ? { pointerId: event.pointerId, tool, start: { x: event.clientX, y: event.clientY }, pan, scale }
      : { pointerId: event.pointerId, tool, size: brushSize / displayScale, points: [point] };
    if (tool !== 'move') renderMask(gesture.current);
    updateCursor(event);
  }

  function move(event) {
    if (!imageSize || failed) return;
    updateCursor(event);
    const active = gesture.current;
    if (!active || active.pointerId !== event.pointerId) return;
    if (active.tool === 'move') {
      const x = active.pan.x + (event.clientX - active.start.x) / active.scale;
      const y = active.pan.y + (event.clientY - active.start.y) / active.scale;
      const maxX = (area.width + imageSize.width * displayScale) / 2 - 32;
      const maxY = (area.height + imageSize.height * displayScale) / 2 - 32;
      setPan({ x: Math.max(-maxX, Math.min(maxX, x)), y: Math.max(-maxY, Math.min(maxY, y)) });
    } else {
      active.points.push(position(event));
      renderMask(active);
    }
  }

  function finish(event, cancelled = false) {
    const active = gesture.current;
    if (!active || active.pointerId !== event.pointerId) return;
    gesture.current = null;
    if (active.tool !== 'move') {
      if (!cancelled) onStroke({ tool: active.tool, size: active.size, points: active.points });
      else renderMask();
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  return (
    <div ref={viewport} className="inpaint-stage" data-tool={tool} onPointerDown={start} onPointerMove={move} onPointerUp={finish} onPointerCancel={(event) => finish(event, true)} onLostPointerCapture={(event) => finish(event, true)} onPointerLeave={() => setCursor(null)}>
      {(!imageSize || failed) && <span className="inpaint-status" role="status">{failed || !imageUrl ? '图片加载失败，请关闭后重试' : '图片加载中…'}</span>}
      <div className="inpaint-image-plane" style={{ width: imageSize ? imageSize.width * displayScale : 0, height: imageSize ? imageSize.height * displayScale : 0, transform: `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px)` }}>
        <img ref={image} src={imageUrl || undefined} alt="局部重绘原图" draggable={false} onLoad={() => { const size = { width: image.current.naturalWidth, height: image.current.naturalHeight }; setImageSize(size); onReady(true); }} onError={() => { setFailed(true); onReady(false); }} />
        <canvas ref={canvas} width={imageSize?.width || 1} height={imageSize?.height || 1} aria-label="局部重绘蒙版" />
      </div>
      {cursor && imageSize && !failed && tool !== 'move' && <span className="inpaint-cursor" style={{ left: cursor.x, top: cursor.y, width: brushSize, height: brushSize }} />}
    </div>
  );
}
