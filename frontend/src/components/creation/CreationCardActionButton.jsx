/**
 * @file CreationCardActionButton.jsx
 * @structure-index
 *
 * 创作结果卡片共用的悬浮操作按钮，保持图标、提示和点击行为由调用方传入。
 */

import { useState } from 'react';

const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba_PuHuiTi_2.0',system-ui,sans-serif";

export default function CreationCardActionButton({ icon, tooltip, onClick }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      {hovered && (
        <div style={{ position: 'absolute', bottom: 'calc(100% + 4px)', left: '50%', translate: '-50% 0', backgroundColor: '#111111', borderRadius: '4px', padding: '2px 8px', whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 10 }}>
          <span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', color: '#FFFFFF' }}>{tooltip}</span>
        </div>
      )}
      <button
        type="button"
        onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{ width: '24px', height: '24px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: hovered ? '#000000B3' : '#00000080', border: 'none', cursor: 'pointer', flexShrink: 0, transition: 'background-color 0.15s' }}
      >
        {icon}
      </button>
    </div>
  );
}
