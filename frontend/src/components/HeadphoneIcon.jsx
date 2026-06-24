import { memo } from 'react';
function HeadphoneIcon({ color = '#2DC3E1' }) {
  return (<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{flexShrink:0}}><path d="M2 11.333V8C2 4.686 4.686 2 8 2C11.314 2 14 4.686 14 8V11.333" stroke={color} strokeLinecap="round" strokeLinejoin="round"/><path d="M2 11.333C2 10.597 2.597 10 3.333 10H4C4.736 10 5.333 10.597 5.333 11.333V13.333C5.333 14.07 4.736 14.667 4 14.667H3.333C2.597 14.667 2 14.07 2 13.333V11.333Z" stroke={color} strokeLinejoin="round"/><path d="M10.667 11.333C10.667 10.597 11.264 10 12 10H12.667C13.403 10 14 10.597 14 11.333V13.333C14 14.07 13.403 14.667 12.667 14.667H12C11.264 14.667 10.667 14.07 10.667 13.333V11.333Z" stroke={color} strokeLinejoin="round"/></svg>);
}
export default memo(HeadphoneIcon);
