import { memo } from 'react';
function PlayingWaveIcon({ color = '#2DC3E1', size = 16 }) {
  return (<svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{flexShrink:0}}>
    <path d="M3.667 5.333V14" stroke={color} strokeLinecap="round" strokeLinejoin="round"/><path d="M8 9.667V14" stroke={color} strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M8 6.333V2" stroke={color} strokeLinecap="round" strokeLinejoin="round"/><path d="M12.334 2V10.667" stroke={color} strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="3.667" cy="3.667" r="1.667" stroke={color} strokeLinejoin="round"/><circle cx="8.001" cy="8" r="1.667" stroke={color} strokeLinejoin="round"/>
    <circle cx="12.333" cy="12.333" r="1.667" stroke={color} strokeLinejoin="round"/>
  </svg>);
}
export default memo(PlayingWaveIcon);
