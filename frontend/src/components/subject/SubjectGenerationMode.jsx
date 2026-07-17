/**
 * @file SubjectGenerationMode.jsx
 * @structure-index
 *
 * ─── 组件职责 ───────────────────────────────────────────────────────
 *   SubjectGenerationMode  主体生图的单视图 / 多视图模式选择
 *   RadioOption             单个模式选项的悬停、选中视觉和变更回调
 *
 * ─── 依赖边界 ───────────────────────────────────────────────────────
 *   只接收当前值、选项和 onChange 回调
 *   不调用 API、不读取 Store、不依赖页面组件或生成任务状态
 *
 * ─── 更新记录 ───────────────────────────────────────────────────────
 *   2026-07-15  从 SubjectPage 的 EditSubjectPanel 抽离生成方式选择区
 */
import { useState } from 'react';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif";

const DEFAULT_OPTIONS = [
  { value: 'single', label: '单视图' },
  { value: 'three_view', label: '多视图' },
];

function RadioOption({ label, checked, onChange }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      role="radio"
      aria-checked={checked}
      tabIndex={0}
      style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
      onClick={onChange}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onChange?.();
        }
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{ position: 'relative', width: '16px', height: '16px', flexShrink: 0 }}>
        <div style={{
          borderRadius: '50%',
          background: checked ? '#2DC3E1' : hovered ? '#1A1A1A' : '#090909',
          border: '1px solid rgba(255,255,255,0.2)',
          outline: '1px solid #00000080',
          width: '16px', height: '16px',
          transition: 'background 100ms',
        }} />
        {checked && <div style={{ position: 'absolute', left: '50%', top: '50%', translate: '-50% -50%', borderRadius: '50%', background: '#0A0A0A', width: '6px', height: '6px' }} />}
      </div>
      <span style={{ fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: checked ? '#FFFFFF' : hovered ? '#FFFFFFCC' : '#FFFFFF99', transition: 'color 100ms' }}>
        {label}
      </span>
    </div>
  );
}

export default function SubjectGenerationMode({
  value = 'single',
  options = DEFAULT_OPTIONS,
  onChange,
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <span style={{ fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: '#FFFFFF99' }}>生成方式</span>
      <div role="radiogroup" style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
        {options.map((option) => (
          <RadioOption
            key={option.value}
            label={option.label}
            checked={option.value === value}
            onChange={() => onChange?.(option.value)}
          />
        ))}
      </div>
    </div>
  );
}
