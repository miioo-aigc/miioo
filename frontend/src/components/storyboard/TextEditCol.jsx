import { useState } from 'react';

/**
 * @file TextEditCol.jsx
 * @structure-index
 *
 * ─── 文本编辑组件 ─────────────────────────────────────────────────
 *   EditableText  单值点击编辑、失焦提交和 Escape 取消
 *   TextEditCol   光影/环境音等文本编辑列的布局容器
 *
 * ─── 依赖边界 ─────────────────────────────────────────────────────
 *   只通过 value、label 和 onChange 接收页面数据；不读取页面状态、API、
 *   Store 或页面闭包。文本值的持久化由 StoryboardPage 继续负责。
 *
 * ─── 更新记录 ─────────────────────────────────────────────────────
 *   2026-07-15  从 StoryboardPage 抽离可编辑文本和文本编辑列
 */

function EditableText({ value, onChange, placeholder = '点击编辑…', style = {} }) {
  const [editing, setEditing] = useState(false);
  const [draftState, setDraftState] = useState({ sourceValue: value, draft: value });
  const draft = draftState.sourceValue === value ? draftState.draft : value;

  function activate() {
    setEditing(true);
    setDraftState({ sourceValue: value, draft: value });
  }

  function commit() {
    setEditing(false);
    if (draft !== value) onChange?.(draft);
  }

  if (editing) {
    return (
      <textarea
        autoFocus
        value={draft}
        onChange={(event) => setDraftState({ sourceValue: value, draft: event.target.value })}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setEditing(false);
            setDraftState({ sourceValue: value, draft: value });
          }
        }}
        style={{
          width: '100%',
          flex: 1,
          minHeight: 0,
          resize: 'none',
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(45,195,225,0.60)',
          borderRadius: '4px',
          padding: '4px 6px',
          fontSize: '14px',
          lineHeight: '20px',
          color: 'rgba(255,255,255,0.60)',
          outline: 'none',
          fontFamily: '"Alibaba PuHuiTi 2.0", system-ui, sans-serif',
          boxSizing: 'border-box',
          ...style,
        }}
      />
    );
  }

  return (
    <div
      onClick={activate}
      style={{
        flex: 1,
        minHeight: 0,
        fontSize: '14px',
        lineHeight: '20px',
        color: value ? 'rgba(255,255,255,0.80)' : 'rgba(255,255,255,0.30)',
        cursor: 'text',
        wordBreak: 'break-all',
        overflowY: 'auto',
        fontFamily: '"Alibaba PuHuiTi 2.0", system-ui, sans-serif',
        ...style,
      }}
    >
      {value || placeholder}
    </div>
  );
}

export { EditableText };

export default function TextEditCol({ label, value, onChange, isLast = false }) {
  return (
    <div style={{
      width: '10%',
      minWidth: '180px',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      padding: '12px',
      borderRight: isLast ? 'none' : '1px solid rgba(255,255,255,0.08)',
      overflow: 'hidden',
      alignSelf: 'stretch',
    }}>
      <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.60)', fontFamily: '"Alibaba PuHuiTi 2.0", system-ui, sans-serif', flex: '0 1 auto', height: '20px', display: 'flex', justifyContent: 'flex-start', alignItems: 'center' }}>
        {label}
      </span>
      <EditableText value={value} onChange={onChange} placeholder="点击编辑…" />
    </div>
  );
}
