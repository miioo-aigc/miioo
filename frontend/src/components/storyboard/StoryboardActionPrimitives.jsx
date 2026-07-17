/**
 * @file StoryboardActionPrimitives.jsx
 * @structure-index
 *
 * 分镜生成面板和页面工具区共用的轻量展示原子；不包含业务状态或 API。
 */

import { useState } from 'react';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif";

export function RefSlotButton({ onClick, children }) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '22px', paddingInline: '6px', borderRadius: '6px',
        backgroundColor: pressed ? '#1a1a1a' : hovered ? '#222323' : '#161616',
        border: '1px solid rgba(255,255,255,0.08)', outline: '1px solid #00000080',
        cursor: 'pointer', fontSize: '12px', lineHeight: '14px',
        color: hovered ? 'rgba(255,255,255,0.70)' : 'rgba(255,255,255,0.40)',
        fontFamily: FONT, whiteSpace: 'nowrap', transition: 'background-color 0.10s, color 0.10s',
      }}
    >
      {children}
    </div>
  );
}

export function StoryboardIconPlus({ color = '#FFFFFF40' }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M7 2V12M2 7H12" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
