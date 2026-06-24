import { memo } from 'react';

function SpinnerIcon({ color = '#FFFFFF' }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, animation: 'spin 0.8s linear infinite' }}>
      <circle cx="7" cy="7" r="5.5" stroke={color} strokeOpacity="0.25" strokeWidth="1.5" />
      <path d="M7 1.5A5.5 5.5 0 0 1 12.5 7" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export default memo(SpinnerIcon);
