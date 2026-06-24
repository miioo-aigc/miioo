import { memo } from 'react';
import EmptyIconShell from './EmptyIconShell';

function CreationEmptyIconImage() {
  return (
    <EmptyIconShell>
      <rect x="17" y="21" width="30" height="23" rx="2.5"
        stroke="url(#cei-icon)" strokeWidth="1.5" strokeOpacity="0.9" />
      <circle cx="23.5" cy="27.5" r="2.5"
        stroke="url(#cei-icon)" strokeWidth="1.5" strokeOpacity="0.9" />
      <path d="M17 38 L24 31 L29 36 L34 29 L47 40"
        stroke="url(#cei-icon)" strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.9" />
      <path d="M42 20L42.8 22.2L45 23L42.8 23.8L42 26L41.2 23.8L39 23L41.2 22.2L42 20Z"
        fill="#2DC3E1" fillOpacity="0.85" />
    </EmptyIconShell>
  );
}

export default memo(CreationEmptyIconImage);
