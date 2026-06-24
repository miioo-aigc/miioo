import { memo } from "react";
import EditableText from "./EditableText";
function TextEditCol({ label, value, onChange, isLast = false }) {
  return (
    <div style={{
      width: 'calc(5.695% - 1px)',
      minWidth: '120px',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      padding: '12px',
      borderRight: isLast ? 'none' : '1px solid rgba(255,255,255,0.08)',
      overflow: 'hidden',
      alignSelf: 'stretch',
    }}>
      <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.60)', fontFamily: '"Alibaba PuHuiTi 2.0", system-ui, sans-serif', flexShrink: 0 }}>
        {label}
      </span>
      <EditableText value={value} onChange={onChange} placeholder="点击编辑…" />
    </div>
  );
}

// ─── 旁白配音列容器 ───────────────────────────────────────────────────────────


export default memo(TextEditCol);
