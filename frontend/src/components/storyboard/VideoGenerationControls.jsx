/**
 * @file VideoGenerationControls.jsx
 * @structure-index
 *
 * ─── 组件职责 ───────────────────────────────────────────────────────
 *   VideoGenerationTabs  视频生成模式 Tab 展示和切换回调
 *   VideoSoundToggle     音效标签与开关展示
 *
 * ─── 依赖边界 ───────────────────────────────────────────────────────
 *   只接收当前值和显式回调，不处理模型、参考素材或生成状态
 */
import Toggle from '../Toggle';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif";
const FONT_MEDIUM = "'AlibabaPuHuiTi_2_65_Medium','Alibaba PuHuiTi 2.0',system-ui,sans-serif";

export function VideoGenerationTabs({ value, onChange }) {
  const tabs = [
    { value: 'all', label: '全能参考' },
    { value: 'frame', label: '首尾帧' },
  ];
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '24px', alignSelf: 'stretch' }}>
      {tabs.map((tab) => {
        const selected = value === tab.value;
        return (
          <button
            key={tab.value}
            type="button"
            onClick={() => onChange?.(tab.value)}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', cursor: 'pointer', padding: 0, border: 0, background: 'transparent' }}
          >
            <span style={{ fontSize: '14px', lineHeight: '18px', color: selected ? '#FFFFFF' : 'rgba(255,255,255,0.60)', fontFamily: selected ? FONT_MEDIUM : FONT, fontWeight: selected ? 500 : 400, transition: 'color 0.12s' }}>
              {tab.label}
            </span>
            {selected && <div style={{ height: '2px', alignSelf: 'stretch', backgroundColor: '#DDDDDD', flexShrink: 0 }} />}
          </button>
        );
      })}
    </div>
  );
}

export function VideoSoundToggle({ value, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
      <span style={{ fontSize: '14px', lineHeight: '18px', color: 'rgba(255,255,255,0.60)', fontFamily: FONT, flexShrink: 0 }}>音效</span>
      <Toggle value={value} onChange={onChange} />
    </div>
  );
}
