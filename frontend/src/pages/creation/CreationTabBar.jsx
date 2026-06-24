import { memo } from 'react';
import { FONT, FONT_MEDIUM } from '../../utils/fonts';

const DEFAULT_TABS = [
  { key: 'image', label: '图片' },
  { key: 'video', label: '视频' },
  { key: 'dubbing', label: '配音' },
];

function CreationTabBar({ tabs = DEFAULT_TABS, activeTab, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: '24px', paddingTop: '16px', paddingLeft: '24px', flex: 1, alignSelf: 'stretch' }}>
      {tabs.map(({ key, label }) => {
        const isActive = key === activeTab;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
              padding: 0,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            <span
              style={{
                fontFamily: isActive ? FONT_MEDIUM : FONT,
                fontWeight: isActive ? 500 : 400,
                fontSize: '16px',
                lineHeight: isActive ? '20px' : '18px',
                color: isActive ? '#FFFFFF' : '#FFFFFF99',
                transition: 'color 0.2s, font-weight 0.2s',
                whiteSpace: 'pre',
              }}
            >
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default memo(CreationTabBar);
