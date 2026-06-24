import { memo } from 'react';
import EmptyIconShell from './EmptyIconShell';

function CreationEmptyIconVideo() {
  return (
    <EmptyIconShell>
      <rect x="17" y="22" width="30" height="21" rx="2.5"
        stroke="url(#cei-icon)" strokeWidth="1.5" strokeOpacity="0.9" />
      <line x1="17" y1="27" x2="47" y2="27"
        stroke="url(#cei-icon)" strokeWidth="1.5" strokeOpacity="0.6" />
      <line x1="17" y1="38" x2="47" y2="38"
        stroke="url(#cei-icon)" strokeWidth="1.5" strokeOpacity="0.6" />
      <line x1="22" y1="22" x2="22" y2="27" stroke="url(#cei-icon)" strokeWidth="1.5" strokeOpacity="0.6" />
      <line x1="28" y1="22" x2="28" y2="27" stroke="url(#cei-icon)" strokeWidth="1.5" strokeOpacity="0.6" />
      <line x1="36" y1="22" x2="36" y2="27" stroke="url(#cei-icon)" strokeWidth="1.5" strokeOpacity="0.6" />
      <line x1="42" y1="22" x2="42" y2="27" stroke="url(#cei-icon)" strokeWidth="1.5" strokeOpacity="0.6" />
      <line x1="22" y1="38" x2="22" y2="43" stroke="url(#cei-icon)" strokeWidth="1.5" strokeOpacity="0.6" />
      <line x1="28" y1="38" x2="28" y2="43" stroke="url(#cei-icon)" strokeWidth="1.5" strokeOpacity="0.6" />
      <line x1="36" y1="38" x2="36" y2="43" stroke="url(#cei-icon)" strokeWidth="1.5" strokeOpacity="0.6" />
      <line x1="42" y1="38" x2="42" y2="43" stroke="url(#cei-icon)" strokeWidth="1.5" strokeOpacity="0.6" />
      <path d="M28.5 29.5 L28.5 35.5 L34.5 32.5 Z"
        stroke="url(#cei-icon)" strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.9" />
      <path d="M42 20L42.8 22.2L45 23L42.8 23.8L42 26L41.2 23.8L39 23L41.2 22.2L42 20Z"
        fill="#2DC3E1" fillOpacity="0.85" />
    </EmptyIconShell>
  );
}

export default memo(CreationEmptyIconVideo);
