import { memo } from 'react';
import { FONT } from '../utils/fonts';

function TabBar({ tabs, active, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: '24px', paddingTop: '16px', paddingLeft: '24px', paddingRight: '24px', height: '48px', flexShrink: 0 }}>
      {tabs.map((tab) => {
        const isActive = tab === active;
        return (
          <div key={tab} onClick={() => onChange?.(tab)} style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '4px', padding: 0, border: 'none', background: 'transparent', outline: 'none' }}>
            <span style={{ fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: isActive ? '#FFFFFF' : '#FFFFFF66', transition: 'color 0.2s', whiteSpace: 'pre' }}>{tab}</span>
            {isActive && <div style={{ height: '2px', borderRadius: '1px', backgroundColor: '#2DC3E1', width: '100%' }} />}
          </div>
        );
      })}
    </div>
  );
}
export default memo(TabBar);
