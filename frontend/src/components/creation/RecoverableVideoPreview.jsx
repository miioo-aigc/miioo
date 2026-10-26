import { useEffect, useRef } from 'react';
import { useMediaPlayback } from '../../hooks/useMediaPlayback';
import MediaLoadStatus from '../feedback/MediaLoadStatus';

export default function RecoverableVideoPreview({ src, poster, hovered, objectFit = 'cover' }) {
  const ref = useRef(null);
  const media = useMediaPlayback(ref, src);
  const { play, pause } = media;
  const hoverRecoveryAttempted = useRef(false);
  useEffect(() => {
    if (hovered) void play({ automatic: true, hover: true });
    else { pause(); if (ref.current) ref.current.currentTime = 0; }
  }, [hovered, play, pause, src]);
  useEffect(() => {
    if (!hovered || media.status === 'error') hoverRecoveryAttempted.current = false;
    if (!hovered || !media.requiresClick || media.status !== 'ready' || hoverRecoveryAttempted.current) return;
    hoverRecoveryAttempted.current = true;
    void play({ automatic: true, hover: true });
  }, [hovered, media.status, media.requiresClick, play]);
  return <>
    <video key={src} ref={ref} src={src} poster={poster || undefined} muted loop playsInline preload="metadata" style={{ width: '100%', height: '100%', objectFit, display: 'block' }} />
    <MediaLoadStatus visual {...media} requiresClick={false} onPause={media.pause} onRetry={media.retry} onPlay={() => media.play()} />
  </>;
}
