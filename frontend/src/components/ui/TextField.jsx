/**
 * @file TextField.jsx
 * @structure-index
 *
 * ─── 组件职责 ───────────────────────────────────────────────────────
 *   TextField 提供无业务的单行/多行受控文本输入视觉和交互
 *
 * ─── 依赖边界 ───────────────────────────────────────────────────────
 *   只接收字段值、标签和事件回调，不调用 API、不读取 Store
 */
import { useState } from 'react';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif";
const FONT_MEDIUM = "'AlibabaPuHuiTi_2_65_Medium','Alibaba PuHuiTi 2.0',system-ui,sans-serif";

export default function TextField({ label, value = '', multiline = false, onChange, onBlur, ...inputProps }) {
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const fieldStyle = {
    display: 'flex', flexDirection: multiline ? 'column' : 'row',
    ...(multiline ? { height: '120px', padding: '9px 12px' } : { alignItems: 'center', height: '36px', padding: '0 12px' }),
    borderRadius: '8px',
    background: focused ? 'rgba(45,195,225,0.04)' : hovered ? '#222222' : '#1D1E1E',
    border: `1px solid ${focused ? 'rgba(45,195,225,0.6)' : hovered ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)'}`,
    outline: focused ? '3px solid rgba(45,195,225,0.08)' : '1px solid #00000080',
    transition: 'border-color 120ms, background 120ms',
  };
  const inputStyle = {
    flex: 1, background: 'transparent', border: 'none', outline: 'none',
    ...(multiline ? { resize: 'none', fontFamily: FONT, lineHeight: '150%' } : { fontFamily: FONT_MEDIUM, fontWeight: 500 }),
    fontSize: '14px', lineHeight: multiline ? '150%' : '18px', color: '#FFFFFF',
  };
  const handleBlur = () => { setFocused(false); onBlur?.(); };
  const commonProps = {
    value, onChange, onFocus: () => setFocused(true), onBlur: handleBlur, style: inputStyle, ...inputProps,
  };
  if (!multiline) {
    commonProps.onKeyDown = (event) => {
      if (event.key === 'Enter') event.currentTarget.blur();
      inputProps.onKeyDown?.(event);
    };
  }
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {label && <span style={{ fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: '#FFFFFF99' }}>{label}</span>}
      <div onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} style={fieldStyle}>
        {multiline ? <textarea {...commonProps} /> : <input {...commonProps} />}
      </div>
    </label>
  );
}
