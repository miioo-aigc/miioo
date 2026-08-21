/**
 * @file VideoGenerationControls.jsx
 * @structure-index
 *
 * ─── 组件职责 ───────────────────────────────────────────────────────
 *   VideoSoundToggle     音效标签与开关展示
 *
 * ─── 依赖边界 ───────────────────────────────────────────────────────
 *   只接收当前值和显式回调，不处理模型、参考素材或生成状态
 */
import Toggle from '../Toggle';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif";

export function VideoSoundToggle({ value, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
      <span style={{ fontSize: '14px', lineHeight: '18px', color: 'rgba(255,255,255,0.60)', fontFamily: FONT, flexShrink: 0 }}>音效</span>
      <Toggle value={value} onChange={onChange} />
    </div>
  );
}
