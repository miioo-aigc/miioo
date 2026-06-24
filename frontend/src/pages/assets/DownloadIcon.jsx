import { FONT } from '../../utils/fonts';

export default function DownloadIcon({ color = 'currentColor' }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <path d="M2.667 11.333V13.333H13.333V11.333" stroke={color} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 2.667V10.667" stroke={color} strokeLinecap="round" />
      <path d="M5 7.667L8 10.667L11 7.667" stroke={color} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
