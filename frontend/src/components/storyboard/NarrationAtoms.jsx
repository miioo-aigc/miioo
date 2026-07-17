import { useState } from 'react';

function CharTag({ name, onClick }) {
  const [hov, setHov] = useState(false);

  return (
    <span
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        paddingInline: '4px',
        borderRadius: '4px',
        fontSize: '14px',
        lineHeight: '18px',
        backgroundColor: hov ? 'rgba(226,226,75,0.25)' : 'rgba(226,226,75,0.15)',
        color: '#E2E24B',
        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)',
        fontFamily: '"Alibaba PuHuiTi 2.0", system-ui, sans-serif',
        flexShrink: 0,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'background-color 0.12s',
      }}
    >
      {name}
    </span>
  );
}

// ─── 通用虚线添加格（旁白列空态展示用）────────────────────────────────────────

function AddSlotBtn({ onClick }) {
  const [hov, setHov] = useState(false);
  const [pressed, setPressed] = useState(false);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => { setHov(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      style={{
        width: '44px',
        height: '44px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '4px',
        backgroundColor: pressed ? 'rgba(255,255,255,0.08)' : hov ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.03)',
        border: `1px dashed ${hov ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.12)'}`,
        cursor: 'pointer',
        flexShrink: 0,
        transition: 'background-color 0.12s, border-color 0.12s',
      }}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M8 3v10M3 8h10" stroke={hov ? 'rgba(255,255,255,0.70)' : 'rgba(255,255,255,0.25)'} strokeWidth="1.3" strokeLinecap="round" /></svg>
    </div>
  );
}


export { CharTag, AddSlotBtn };
