import { useState, memo } from 'react';
import { IconPlus } from './StoryboardIcons';

function AddSlotBtn({ onClick }) {
  const [hov, setHov] = useState(false);
  const [pressed, setPressed] = useState(false);
  return (
    <div onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => { setHov(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)} onMouseUp={() => setPressed(false)}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '28px', borderRadius: '6px', border: '1px dashed rgba(255,255,255,0.15)', cursor: 'pointer', background: pressed ? 'rgba(255,255,255,0.06)' : hov ? 'rgba(255,255,255,0.04)' : 'transparent', transition: 'background 0.10s', gap: '4px', paddingInline: '10px' }}>
      <IconPlus color="#FFFFFF40" />
      <span style={{ fontSize: '12px', lineHeight: '16px', color: '#FFFFFF40', fontFamily: '"Alibaba PuHuiTi 2.0", system-ui, sans-serif' }}>添加</span>
    </div>
  );
}
export default memo(AddSlotBtn);
