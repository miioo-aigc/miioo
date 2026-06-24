import { memo } from 'react';
import { FONT, FONT_MEDIUM } from '../utils/fonts';

function ModuleTabBar({ tabs, active, onChange }) {
  return (
    <div style={{ display: 'flex', gap: '2px', backgroundColor: '#FFFFFF0A', borderRadius: '8px', padding: '2px', flexShrink: 0 }}>
      {tabs.map((tab) => {
        const isActive = tab.value === active;
        return (
          <div key={tab.value} onClick={() => onChange?.(tab.value)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '32px', paddingInline: '14px', borderRadius: '6px', cursor: 'pointer', backgroundColor: isActive ? '#161616' : 'transparent', transition: 'background-color 0.12s' }}>
            <span style={{ fontFamily: isActive ? FONT_MEDIUM : FONT, fontWeight: isActive ? 500 : 400, fontSize: '14px', lineHeight: '20px', color: isActive ? '#FFFFFF' : '#FFFFFF66', whiteSpace: 'nowrap' }}>{tab.label}</span>
          </div>
        );
      })}
    </div>
  );
}
export default memo(ModuleTabBar);
