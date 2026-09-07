export function RatioIcon({ rw = 16, rh = 9, selected = false, color = '#FFFFFFCC' }) {
  const maxW = 16;
  const maxH = 12;
  const portrait = rh > rw;
  const baseW = portrait ? rh : rw;
  const baseH = portrait ? rw : rh;
  const scale = Math.min(maxW / baseW, maxH / baseH);
  const wBase = Math.round(baseW * scale);
  const hBase = Math.round(baseH * scale);
  const width = portrait ? hBase : wBase;
  const height = portrait ? wBase : hBase;
  return (
    <span
      style={{
        display: 'block',
        width: `${width}px`,
        height: `${height}px`,
        borderRadius: '2px',
        flexShrink: 0,
        boxShadow: `${selected ? '#FFFFFF' : color} 0px 0px 0px 1px inset`,
      }}
    />
  );
}
