import { memo } from 'react';

function StarIcon({ filled = false, strokeColor = '#FFFFFF' }) {
  return (
    <svg width="16" height="16" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
      <path
        d="M7 1.5l1.545 3.13 3.455.503-2.5 2.436.59 3.44L7 9.369l-3.09 1.64.59-3.44L2 5.133l3.455-.503L7 1.5z"
        fill={filled ? '#F0B429' : 'none'}
        stroke={filled ? '#F0B429' : strokeColor}
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default memo(StarIcon);
