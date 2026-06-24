 import { useState } from "react";
 import { FONT } from "../../utils/fonts";

export default function RadioOption({ label, checked, onChange }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
      onClick={onChange}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{ position: 'relative', width: '16px', height: '16px', flexShrink: 0 }}>
        <div style={{
          borderRadius: '50%',
          background: checked ? '#2DC3E1' : hovered ? '#1A1A1A' : '#090909',
          border: `1px solid ${checked ? 'rgba(255,255,255,0.2)' : hovered ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.2)'}`,
          outline: '1px solid #00000080',
          width: '16px', height: '16px',
          transition: 'background 100ms',
        }} />
        {checked && <div style={{ position: 'absolute', left: '50%', top: '50%', translate: '-50% -50%', borderRadius: '50%', background: '#0A0A0A', width: '6px', height: '6px' }} />}
      </div>
      <span style={{ fontFamily: FONT, fontSize: '14px', lineHeight: '18px', color: checked ? '#FFFFFF' : hovered ? '#FFFFFFCC' : '#FFFFFF99', transition: 'color 100ms' }}>{label}</span>
    </div>
  );
}
