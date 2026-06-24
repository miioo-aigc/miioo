import { FONT } from '../../utils/fonts';

export default function TrashIcon({ color = 'currentColor' }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <path d="M3 3.333V14.667H13V3.333H3Z" stroke={color} strokeLinejoin="round" />
      <path d="M6.667 6.667V11" stroke={color} strokeLinecap="round" />
      <path d="M9.333 6.667V11" stroke={color} strokeLinecap="round" />
      <path d="M1.333 3.333H14.667" stroke={color} strokeLinecap="round" />
      <path d="M5.333 3.333L6.43 1.333H9.592L10.667 3.333H5.333Z" stroke={color} strokeLinejoin="round" />
    </svg>
  );
}
