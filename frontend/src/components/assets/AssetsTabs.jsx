const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif";
const FONT_MEDIUM = "'AlibabaPuHuiTi_2_65_Medium','Alibaba PuHuiTi 2.0',system-ui,sans-serif";

export function AssetsTabBar({ tabs, active, onChange }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'baseline',
      gap: '24px',
      paddingTop: '16px',
      paddingLeft: '24px',
      paddingRight: '24px',
      height: '48px',
    }}>
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        return (
          <button
            key={tab.key}
            type="button"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              fontFamily: isActive ? FONT_MEDIUM : FONT,
              fontSize: '14px',
              lineHeight: '18px',
              color: isActive ? '#FFFFFF' : '#FFFFFF99',
              transition: 'color 0.12s',
            }}
            onClick={() => onChange(tab.key)}
          >
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function AssetsModuleTabBar({ tabs, active, onChange }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-end',
      paddingLeft: '24px',
      paddingRight: '24px',
      gap: '24px',
      borderBottom: '1px solid #FFFFFF14',
    }}>
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        return (
          <button
            key={tab.key}
            type="button"
            style={{
              background: 'none',
              border: 'none',
              borderBottom: '2px solid transparent',
              paddingTop: '12px',
              paddingBottom: '6px',
              cursor: 'pointer',
              fontFamily: isActive ? FONT_MEDIUM : FONT,
              fontSize: '16px',
              color: isActive ? '#2DC3E1' : '#FFFFFF99',
              transition: 'color 0.12s',
            }}
            onClick={() => onChange(tab.key)}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
