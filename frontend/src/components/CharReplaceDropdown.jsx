import { useState, useRef, useEffect, memo } from 'react';
import CharTag from './CharTag';

function CharReplaceDropdown({ chars, current, onSelect, onClose, triggerRef }) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  useEffect(() => {
    if (triggerRef?.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, left: rect.left });
    }
  }, [triggerRef]);
  useEffect(() => {
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) onClose?.(); }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);
  const others = (chars || []).filter(c => c.id !== current?.id);
  if (!others.length) return null;
  return (
    <div ref={ref} style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 100, backgroundColor: '#1D1E1E', border: '1px solid rgba(255,255,255,0.10)', borderRadius: '8px', padding: '4px', boxShadow: '0 4px 16px rgba(0,0,0,0.40)', minWidth: '120px' }}>
      {others.map((c) => (
        <div key={c.id} onClick={() => { onSelect?.(c); onClose?.(); }}
          style={{ display: 'flex', alignItems: 'center', height: '32px', paddingInline: '8px', borderRadius: '6px', cursor: 'pointer' }}>
          <CharTag name={c.name} />
        </div>
      ))}
    </div>
  );
}
export default memo(CharReplaceDropdown);
