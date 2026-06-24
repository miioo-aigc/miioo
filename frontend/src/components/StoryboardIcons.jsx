import { memo } from 'react';

export const IconBatchImage = memo(() => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{flexShrink: 0}}>
    <path d="M3 5V3.188C3 2.891 3.029 2.783 3.083 2.674C3.138 2.566 3.218 2.481 3.32 2.422C3.422 2.364 3.523 2.333 3.801 2.333H12.199C12.477 2.333 12.578 2.364 12.68 2.422C12.782 2.481 12.862 2.566 12.916 2.674C12.971 2.783 13 2.891 13 3.188V5" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M1.667 5H14.333V13.667H1.667V5Z" stroke="#FFFFFF" strokeLinejoin="round" />
    <path fillRule="evenodd" clipRule="evenodd" d="M4.333 8.667C4.886 8.667 5.333 8.219 5.333 7.667C5.333 7.114 4.886 6.667 4.333 6.667C3.781 6.667 3.333 7.114 3.333 7.667C3.333 8.219 3.781 8.667 4.333 8.667Z" fill="#FFFFFF" />
    <path d="M1.856 13.463L5 10L6.667 11.333L9 9L14.131 13.463" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
));

export const IconBatchVideo = memo(() => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{flexShrink: 0}}>
    <path d="M3 5V3.188C3 2.891 3.029 2.783 3.083 2.674C3.138 2.566 3.218 2.481 3.32 2.422C3.422 2.364 3.523 2.333 3.801 2.333H12.199C12.477 2.333 12.578 2.364 12.68 2.422C12.782 2.481 12.862 2.566 12.916 2.674C12.971 2.783 13 2.891 13 3.188V5" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M1.667 5H14.333V13.667H1.667V5Z" stroke="#FFFFFF" strokeLinejoin="round" />
    <path d="M6 8.5V11L9 9.5V11L11 9.5V8L9 9.5V8L6 9.5V8.5Z" fill="#FFFFFF" />
  </svg>
));

export const IconDownload = memo(() => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{flexShrink: 0}}>
    <path d="M8 2.667V10" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M5.333 7.333L8 10L10.667 7.333" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M2.667 12H13.333" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
));

export const IconEdit = memo(() => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{flexShrink: 0}}>
    <path d="M2.333 14H14.333" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M3.667 8.907V11.333H6.106L13 4.436L10.565 2L3.667 8.907Z" stroke="#FFFFFFCC" strokeLinejoin="round" />
  </svg>
));

export const IconDrag = memo(() => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" style={{flexShrink: 0}}>
    <circle cx="5" cy="2" r="1" fill="#FFFFFF40" /><circle cx="5" cy="6" r="1" fill="#FFFFFF40" /><circle cx="5" cy="10" r="1" fill="#FFFFFF40" />
    <circle cx="9" cy="2" r="1" fill="#FFFFFF40" /><circle cx="9" cy="6" r="1" fill="#FFFFFF40" /><circle cx="9" cy="10" r="1" fill="#FFFFFF40" />
  </svg>
));

export const IconAdd = memo(() => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{flexShrink: 0}}>
    <path d="M3.333 8H12.667" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M8 3.333V12.667" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
));

export const IconCopy = memo(() => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" style={{flexShrink: 0}}>
    <path d="M3.5 7V9.333H10.5V7" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M7 4.667V11.667" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
));

export const IconDelete = memo(() => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{flexShrink: 0}}>
    <path d="M3 3.333V14.667H13V3.333H3Z" stroke="#FFFFFFCC" strokeLinejoin="round" />
    <path d="M6.667 6.667V11" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M9.333 6.667V11" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M1.333 3.333H14.667" stroke="#FFFFFFCC" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M5.333 3.333L6.43 1.333H9.592L10.667 3.333H5.333Z" stroke="#FFFFFFCC" strokeLinejoin="round" />
  </svg>
));

export const IconPlus = memo(({ color = '#FFFFFF40' }) => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{flexShrink: 0}}>
    <path d="M8 3v10M3 8h10" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
  </svg>
));

export const IconClose = memo(() => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{flexShrink: 0}}>
    <path d="M2.667 2.667L13.333 13.333" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M2.667 13.333L13.333 2.667" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
));

export const IconImagePlaceholder = memo(() => (
  <svg width="40" height="30" viewBox="0 0 40 30" fill="none" xmlns="http://www.w3.org/2000/svg" style={{flexShrink: 0}}>
    <rect x="1" y="1" width="38" height="28" rx="3" stroke="#FFFFFF33" strokeWidth="1.5" />
    <circle cx="14" cy="10" r="3" stroke="#FFFFFF33" strokeWidth="1.5" />
    <path d="M4 23l12-12 8 8 8-8 8 8" stroke="#FFFFFF33" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
));

export const IconVideoPlaceholder = memo(() => (
  <svg width="48" height="30" viewBox="0 0 48 30" fill="none" xmlns="http://www.w3.org/2000/svg" style={{flexShrink: 0}}>
    <rect x="1" y="1" width="46" height="28" rx="3" stroke="#FFFFFF33" strokeWidth="1.5" />
    <path d="M19 10L29 15L19 20V10Z" fill="#FFFFFF33" />
  </svg>
));
