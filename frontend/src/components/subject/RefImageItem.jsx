/**
 * @file RefImageItem.jsx
 * @structure-index
 *
 * ─── 组件职责 ───────────────────────────────────────────────────────
 *   RefImageItem 展示参考图、处理悬浮预览和删除回调
 *
 * ─── 依赖边界 ───────────────────────────────────────────────────────
 *   只接收图片地址和删除回调，不调用 API、不读取 Store
 */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

function SubjectRefHoverPreview({ url, mouseX, mouseY }) {
  const [size, setSize] = useState(null);
  const GAP = 16;

  useEffect(() => {
    const img = new Image();
    img.onload = () => setSize({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = url;
  }, [url]);

  if (!size) return null;
  const maxW = window.innerWidth * 0.35;
  const maxH = window.innerHeight * 0.35;
  const ratio = size.w / size.h;
  let previewW;
  let previewH;
  if (ratio >= 1) {
    previewW = maxW;
    previewH = previewW / ratio;
    if (previewH > maxH) { previewH = maxH; previewW = previewH * ratio; }
  } else {
    previewH = maxH;
    previewW = previewH * ratio;
    if (previewW > maxW) { previewW = maxW; previewH = previewW / ratio; }
  }
  let left = mouseX + GAP;
  let top = mouseY + GAP;
  if (left + previewW > window.innerWidth - GAP) left = mouseX - previewW - GAP;
  if (top + previewH > window.innerHeight - GAP) top = mouseY - previewH - GAP;
  left = Math.max(GAP, left);
  top = Math.max(GAP, top);

  return (
    <div style={{ position: 'fixed', left, top, width: previewW, height: previewH, zIndex: 99999, pointerEvents: 'none', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.7)', border: '1px solid rgba(255,255,255,0.12)', backgroundColor: '#111' }}>
      <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
    </div>
  );
}

export default function RefImageItem({ url, onRemove }) {
  const [hovered, setHovered] = useState(false);
  const [previewPos, setPreviewPos] = useState(null);
  const [imageFailed, setImageFailed] = useState(false);
  const hoverTimerRef = useRef(null);

  function handleMouseEnter(event) {
    setHovered(true);
    if (imageFailed) return;
    hoverTimerRef.current = setTimeout(() => setPreviewPos({ x: event.clientX, y: event.clientY }), 500);
  }
  function handleMouseMove(event) {
    setPreviewPos((pos) => pos ? { x: event.clientX, y: event.clientY } : pos);
  }
  function handleMouseLeave() {
    setHovered(false);
    clearTimeout(hoverTimerRef.current);
    setPreviewPos(null);
  }

  return (
    <>
      <div onMouseEnter={handleMouseEnter} onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave} style={{ width: '120px', height: '120px', borderRadius: '8px', overflow: 'hidden', position: 'relative', flexShrink: 0, border: `1px solid ${hovered ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)'}`, transition: 'border-color 120ms', cursor: 'pointer' }}>
        {url && !imageFailed && <img src={url} alt="参考图" onError={() => { setImageFailed(true); setPreviewPos(null); }} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
        {imageFailed && <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFFFFF66', fontSize: '12px', backgroundColor: '#FFFFFF0A' }}>图片加载失败</div>}
        {hovered && <div onClick={(event) => { event.stopPropagation(); clearTimeout(hoverTimerRef.current); setPreviewPos(null); onRemove?.(); }} style={{ position: 'absolute', top: '4px', right: '4px', width: '18px', height: '18px', borderRadius: '4px', backgroundColor: 'rgba(0,0,0,0.70)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true"><path d="M2 2L8 8M8 2L2 8" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round" /></svg>
        </div>}
      </div>
      {previewPos && url && !imageFailed && createPortal(<SubjectRefHoverPreview url={url} mouseX={previewPos.x} mouseY={previewPos.y} />, document.body)}
    </>
  );
}
