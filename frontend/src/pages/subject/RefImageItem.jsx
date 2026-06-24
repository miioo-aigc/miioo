import { useState } from "react";
import SubjectRefHoverPreview from "./SubjectRefHoverPreview";

export default 
function RefImageItem({ url, onRemove }) {
  const [hovered, setHovered] = useState(false);
  const [previewPos, setPreviewPos] = useState(null);
  const hoverTimerRef = useRef(null);

  function handleMouseEnter(e) {
    setHovered(true);
    const { clientX, clientY } = e;
    hoverTimerRef.current = setTimeout(() => {
      setPreviewPos({ x: clientX, y: clientY });
    }, 500);
  }

  function handleMouseMove(e) {
    setPreviewPos(pos => pos ? { x: e.clientX, y: e.clientY } : pos);
  }

  function handleMouseLeave() {
    setHovered(false);
    clearTimeout(hoverTimerRef.current);
    setPreviewPos(null);
  }

  return (
    <>
      <div
        onMouseEnter={handleMouseEnter}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{
          width: '120px', height: '120px', borderRadius: '8px', overflow: 'hidden', position: 'relative', flexShrink: 0,
          border: `1px solid ${hovered ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)'}`,
          transition: 'border-color 120ms', cursor: 'pointer',
        }}
      >
        <img src={url} alt="参考图" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        {hovered && (
          <div
            onClick={(e) => { e.stopPropagation(); clearTimeout(hoverTimerRef.current); setPreviewPos(null); onRemove(); }}
            style={{ position: 'absolute', top: '4px', right: '4px', width: '18px', height: '18px', borderRadius: '4px', backgroundColor: 'rgba(0,0,0,0.70)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 2L8 8M8 2L2 8" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round"/></svg>
          </div>
        )}
      </div>
      {previewPos && url && createPortal(
        <SubjectRefHoverPreview url={url} mouseX={previewPos.x} mouseY={previewPos.y} />,
        document.body
      )}
    </>
  );
}
