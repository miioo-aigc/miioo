import { memo } from 'react';

function EmptyIconShell({ children }) {
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="cei-bg" x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFFFFF" stopOpacity="0.12" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0.04" />
        </linearGradient>
        <linearGradient id="cei-stroke" x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFFFFF" stopOpacity="0.24" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0.08" />
        </linearGradient>
        <linearGradient id="cei-icon" x1="18" y1="20" x2="46" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#B7C0CC" />
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="56" height="56" rx="28" fill="url(#cei-bg)" />
      <rect x="4.5" y="4.5" width="55" height="55" rx="27.5" stroke="url(#cei-stroke)" />
      {children}
    </svg>
  );
}

export default memo(EmptyIconShell);
