import { memo } from 'react';
import EmptyIconShell from './EmptyIconShell';

function CreationEmptyIconDubbing() {
  return (
    <EmptyIconShell>
      <rect x="27" y="18" width="10" height="16" rx="5"
        stroke="url(#cei-icon)" strokeWidth="1.5" strokeOpacity="0.9" />
      <path d="M22 31 C22 37 42 37 42 31"
        stroke="url(#cei-icon)" strokeWidth="1.5"
        strokeLinecap="round" strokeOpacity="0.9" />
      <line x1="32" y1="37" x2="32" y2="43"
        stroke="url(#cei-icon)" strokeWidth="1.5"
        strokeLinecap="round" strokeOpacity="0.9" />
      <line x1="27" y1="43" x2="37" y2="43"
        stroke="url(#cei-icon)" strokeWidth="1.5"
        strokeLinecap="round" strokeOpacity="0.9" />
      <path d="M42 20L42.8 22.2L45 23L42.8 23.8L42 26L41.2 23.8L39 23L41.2 22.2L42 20Z"
        fill="#2DC3E1" fillOpacity="0.85" />
    </EmptyIconShell>
  );
}

export default memo(CreationEmptyIconDubbing);
