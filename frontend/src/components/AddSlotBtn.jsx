import { useState, memo } from 'react';
import { IconPlus } from './StoryboardIcons';

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
        border: '1px dashed ' + (hov ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.12)'),
        cursor: 'pointer',
        flexShrink: 0,
        transition: 'background-color 0.12s, border-color 0.12s',
      }}
    >
      <IconPlus color={hov ? 'rgba(255,255,255,0.70)' : undefined} />
    </div>
  );
}
export default memo(AddSlotBtn);
