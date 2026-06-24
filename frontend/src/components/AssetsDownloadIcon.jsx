import { memo } from "react";

function AssetsDownloadIcon({ color = "currentColor" }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M8 2.667V10" stroke={color} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5.333 7.333L8 10L10.667 7.333" stroke={color} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2.667 12H13.333" stroke={color} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
export default memo(AssetsDownloadIcon);
