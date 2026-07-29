function EmptyIconImage() {
  return (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="10" y="14" width="60" height="46" rx="7" fill="rgba(255,255,255,0.06)" />
      <rect x="10" y="14" width="60" height="22" rx="7" fill="rgba(255,255,255,0.04)" />
      <circle cx="26" cy="27" r="8" fill="rgba(255,255,255,0.10)" />
      <circle cx="26" cy="27" r="5" fill="rgba(255,255,255,0.18)" />
      <path d="M10 48 L24 30 L36 42 L48 28 L60 40 L70 32 L70 60 L10 60 Z" fill="rgba(255,255,255,0.07)" />
      <path d="M10 60 L10 52 L22 38 L34 50 L44 38 L58 52 L70 44 L70 60 Z" fill="rgba(255,255,255,0.13)" />
      <rect x="10" y="14" width="60" height="46" rx="7" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
    </svg>
  );
}

function EmptyIconVideo() {
  return (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="8" y="18" width="52" height="38" rx="7" fill="rgba(255,255,255,0.08)" />
      <rect x="8" y="18" width="52" height="9" rx="4" fill="rgba(0,0,0,0.2)" />
      <circle cx="34" cy="42" r="12" fill="rgba(255,255,255,0.13)" />
      <path d="M30.5 36.5 L30.5 47.5 L42 42 Z" fill="rgba(255,255,255,0.5)" />
      <rect x="64" y="18" width="12" height="12" rx="4" fill="rgba(255,255,255,0.11)" />
      <rect x="64" y="33" width="12" height="12" rx="4" fill="rgba(255,255,255,0.07)" />
      <rect x="64" y="48" width="12" height="8" rx="4" fill="rgba(255,255,255,0.04)" />
      <rect x="8" y="58" width="52" height="3" rx="1.5" fill="rgba(255,255,255,0.07)" />
      <rect x="8" y="58" width="20" height="3" rx="1.5" fill="rgba(255,255,255,0.22)" />
      <circle cx="28" cy="59.5" r="3.5" fill="rgba(255,255,255,0.4)" />
    </svg>
  );
}

function EmptyIconAudio() {
  return (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="40" cy="40" r="28" fill="rgba(255,255,255,0.06)" />
      <circle cx="40" cy="40" r="18" fill="rgba(255,255,255,0.05)" />
      <rect x="14" y="34" width="3" height="12" rx="1.5" fill="rgba(255,255,255,0.12)" />
      <rect x="19" y="30" width="3" height="20" rx="1.5" fill="rgba(255,255,255,0.18)" />
      <rect x="24" y="26" width="3" height="28" rx="1.5" fill="rgba(255,255,255,0.22)" />
      <rect x="29" y="30" width="3" height="20" rx="1.5" fill="rgba(255,255,255,0.28)" />
      <rect x="34" y="33" width="3" height="14" rx="1.5" fill="rgba(255,255,255,0.32)" />
      <circle cx="40" cy="40" r="5" fill="rgba(255,255,255,0.28)" />
      <circle cx="40" cy="40" r="2.5" fill="rgba(255,255,255,0.5)" />
      <rect x="43" y="33" width="3" height="14" rx="1.5" fill="rgba(255,255,255,0.32)" />
      <rect x="48" y="30" width="3" height="20" rx="1.5" fill="rgba(255,255,255,0.28)" />
      <rect x="53" y="26" width="3" height="28" rx="1.5" fill="rgba(255,255,255,0.22)" />
      <rect x="58" y="30" width="3" height="20" rx="1.5" fill="rgba(255,255,255,0.18)" />
      <rect x="63" y="34" width="3" height="12" rx="1.5" fill="rgba(255,255,255,0.12)" />
    </svg>
  );
}

function EmptyAssetState({ mediaType = 'image' }) {
  const Icon = mediaType === 'video' ? EmptyIconVideo : mediaType === 'audio' ? EmptyIconAudio : EmptyIconImage;
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Icon />
    </div>
  );
}

function categoryToMediaType(category) {
  if (category === 'final') return 'video';
  if (category === 'audio') return 'audio';
  return 'image';
}

export function EmptyProjectAssets({ category }) {
  return <EmptyAssetState mediaType={categoryToMediaType(category)} />;
}

export function EmptyCreativeAssets({ type }) {
  return <EmptyAssetState mediaType={type === 'dubbing' ? 'audio' : type} />;
}
