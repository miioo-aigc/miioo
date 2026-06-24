import { memo } from 'react';

function RatioIcon({ rw = 16, rh = 9, selected = false }) {
  const maxW = 16, maxH = 12;
  const scale = Math.min(maxW / rw, maxH / rh);
  const w = Math.round(rw * scale);
  const h = Math.round(rh * scale);
  return (
    <div style={{
      width: `${w}px`,
      height: `${h}px`,
      borderRadius: '2px',
      flexShrink: 0,
      boxShadow: selected ? '#FFFFFF 0px 0px 0px 1px inset' : '#FFFFFF66 0px 0px 0px 1px inset',
    }} />
  );
}

export default memo(RatioIcon);
