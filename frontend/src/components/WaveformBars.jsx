import { memo } from 'react';

const bars = [3, 6, 10, 7, 14, 9, 5, 12, 8, 4, 11, 7, 6, 13, 9, 5, 10, 7, 4, 8, 12, 6, 9, 5, 11, 7, 3, 10, 8, 6];

function WaveformBars({ playing }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '2px', height: '24px' }}>
      {bars.map((h, i) => (
        <div key={i} style={{ width: '2px', height: `${h}px`, borderRadius: '1px', backgroundColor: playing ? '#2DC3E1' : '#FFFFFF33', transition: 'background-color 0.2s', flexShrink: 0 }} />
      ))}
    </div>
  );
}
export default memo(WaveformBars);
