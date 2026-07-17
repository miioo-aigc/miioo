import EpisodeItem from './EpisodeItem';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif";
const FONT_MEDIUM = "'AlibabaPuHuiTi_2_65_Medium','Alibaba_PuHuiTi_2.0',system-ui,sans-serif";

export default function EpisodeList({ outline, selectedIndex, onSelect, loading = false }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: '16px',
        width: '216px',
        minWidth: '216px',
        alignSelf: 'stretch',
        flexShrink: 0,
      }}
    >
      <div style={{ fontFamily: FONT_MEDIUM, fontSize: '16px', lineHeight: '20px', color: '#FFFFFF', alignSelf: 'stretch' }}>
        剧集结构
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignSelf: 'stretch', gap: '4px' }}>
        {outline.length > 0 ? (
          outline.map((item, index) => (
            <EpisodeItem
              key={`${item.level}-${item.offset}-${index}`}
              title={item.title}
              level={item.level}
              isSelected={index === selectedIndex}
              onClick={() => onSelect(index)}
            />
          ))
        ) : loading ? (
          [0, 1, 2].map((index) => (
            <div
              key={index}
              style={{
                height: '36px',
                borderRadius: '8px',
                alignSelf: 'stretch',
                background: index === 0 ? '#FFFFFF0A' : 'transparent',
                paddingLeft: '16px',
                paddingRight: '16px',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <div
                style={{
                  width: index === 0 ? '96px' : index === 1 ? '120px' : '88px',
                  height: '10px',
                  borderRadius: '9999px',
                  background: '#FFFFFF12',
                }}
              />
            </div>
          ))
        ) : (
          <div style={{ paddingLeft: '16px', paddingRight: '16px', paddingTop: '8px' }}>
            <span style={{ fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: '#FFFFFF4D' }}>
              等待剧本生成
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
