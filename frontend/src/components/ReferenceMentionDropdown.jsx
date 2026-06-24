import { useState, useRef, useEffect, memo } from 'react';
import SubjectTag from './SubjectTag';

const MENTION_TYPE_LABEL = { character: '角色', scene: '场景', prop: '道具' };
const MENTION_TYPE_COLOR = { character: '#E2E24B', scene: '#71C4FF', prop: '#C084FC' };
const MENTION_TABS = [{ value: 'all', label: '全部' }, { value: 'character', label: '角色' }, { value: 'scene', label: '场景' }, { value: 'prop', label: '道具' }];

function ReferenceMentionDropdown({ referenceItems = [], query, onSelect, onClose, triggerRef }) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [tab, setTab] = useState('all');
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
  const filtered = (referenceItems || []).filter(i => {
    const matchQuery = !query || i.name?.toLowerCase().includes(query.toLowerCase());
    const matchTab = tab === 'all' || i.type === tab;
    return matchQuery && matchTab;
  }).slice(0, 20);
  if (!filtered.length) return null;
  return (
    <div ref={ref} style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 100, backgroundColor: '#1D1E1E', border: '1px solid rgba(255,255,255,0.10)', borderRadius: '8px', padding: '4px', boxShadow: '0 4px 16px rgba(0,0,0,0.40)', minWidth: '160px' }}>
      <div style={{ display: 'flex', gap: '2px', padding: '4px', borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: '4px' }}>
        {MENTION_TABS.map(t => (
          <div key={t.value} onClick={() => setTab(t.value)}
            style={{ padding: '2px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', color: tab === t.value ? '#FFFFFF' : 'rgba(255,255,255,0.50)', backgroundColor: tab === t.value ? 'rgba(255,255,255,0.10)' : 'transparent', fontFamily: "'AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif" }}>
            {t.label}
          </div>
        ))}
      </div>
      {filtered.map((item) => (
        <div key={item.id} onClick={() => { onSelect?.(item); onClose?.(); }}
          style={{ display: 'flex', alignItems: 'center', height: '32px', paddingInline: '8px', borderRadius: '6px', cursor: 'pointer', gap: '6px' }}>
          <SubjectTag name={item.name} type={item.type} />
        </div>
      ))}
    </div>
  );
}
export default memo(ReferenceMentionDropdown);
