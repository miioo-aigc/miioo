/**
 * @file SubjectTextFields.jsx
 * @structure-index
 *
 * ─── 组件职责 ───────────────────────────────────────────────────────
 *   SubjectTextFields  主体编辑面板的名称、描述和提示词字段组合
 *   SubjectTextField   单个字段的 hover / focus 视觉和受控输入
 *
 * ─── 依赖边界 ───────────────────────────────────────────────────────
 *   只接收字段值、变更回调和失焦回调
 *   不调用 API、不读取 Store、不依赖页面组件或主体生成任务
 *
 * ─── 更新记录 ───────────────────────────────────────────────────────
 *   2026-07-15  从 SubjectPage 的 EditSubjectPanel 抽离文本字段组合
 */
import { useState } from 'react';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif";
const FONT_MEDIUM = "'AlibabaPuHuiTi_2_65_Medium','Alibaba PuHuiTi 2.0',system-ui,sans-serif";

function SubjectTextField({ label, value, multiline = false, onChange, onBlur }) {
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);

  const fieldStyle = {
    display: 'flex',
    flexDirection: multiline ? 'column' : 'row',
    ...(multiline ? { height: '120px', padding: '9px 12px' } : { alignItems: 'center', height: '36px', padding: '0 12px' }),
    borderRadius: '8px',
    background: focused ? 'rgba(45,195,225,0.04)' : hovered ? '#222222' : '#1D1E1E',
    border: `1px solid ${focused ? 'rgba(45,195,225,0.6)' : hovered ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)'}`,
    outline: focused ? '3px solid rgba(45,195,225,0.08)' : '1px solid #00000080',
    transition: 'border-color 120ms, background 120ms',
  };

  const inputStyle = {
    flex: 1,
    background: 'transparent',
    border: 'none',
    outline: 'none',
    ...(multiline ? { resize: 'none', fontFamily: FONT, lineHeight: '150%' } : { fontFamily: FONT_MEDIUM, fontWeight: 500 }),
    fontSize: '14px',
    lineHeight: multiline ? '150%' : '18px',
    color: '#FFFFFF',
  };

  const handleFocus = () => setFocused(true);
  const handleBlur = () => {
    setFocused(false);
    onBlur?.();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <span style={{ fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: '#FFFFFF99' }}>{label}</span>
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={fieldStyle}
      >
        {multiline ? (
          <textarea
            value={value}
            onChange={onChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            style={inputStyle}
          />
        ) : (
          <input
            value={value}
            onChange={onChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur();
            }}
            style={inputStyle}
          />
        )}
      </div>
    </div>
  );
}

export default function SubjectTextFields({
  name,
  description,
  prompt,
  onNameChange,
  onDescriptionChange,
  onPromptChange,
  onNameBlur,
  onDescriptionBlur,
  onPromptBlur,
}) {
  return (
    <>
      <SubjectTextField
        label="角色名称"
        value={name}
        onChange={onNameChange}
        onBlur={onNameBlur}
      />
      <SubjectTextField
        label="描述"
        value={description}
        multiline
        onChange={onDescriptionChange}
        onBlur={onDescriptionBlur}
      />
      <SubjectTextField
        label="提示词"
        value={prompt}
        multiline
        onChange={onPromptChange}
        onBlur={onPromptBlur}
      />
    </>
  );
}
