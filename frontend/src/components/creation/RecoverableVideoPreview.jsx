import { useEffect, useRef, useState } from 'react';
import { useMediaPlayback } from '../../hooks/useMediaPlayback';
import MediaLoadStatus from '../feedback/MediaLoadStatus';

function VideoPreviewSession({ src, poster, hovered, objectFit = 'cover' }) {
  const ref = useRef(null);
  const [posterReady, setPosterReady] = useState(false);
  const [frameReady, setFrameReady] = useState(false);
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
  const showVideo = frameReady && (!posterReady || (hovered && media.status !== 'error'));
  return <>
    {poster && <img src={poster} alt="" onLoad={() => setPosterReady(true)} onError={() => setPosterReady(false)}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit, opacity: posterReady && !showVideo ? 1 : 0, pointerEvents: 'none' }} />}
    <video key={src} ref={ref} src={src} poster={poster || undefined} muted loop playsInline preload="metadata" onLoadedData={() => setFrameReady(true)} style={{ width: '100%', height: '100%', objectFit, display: 'block', position: 'relative', opacity: showVideo ? 1 : 0 }} />
    {!posterReady && !(frameReady && media.status === 'error') && <MediaLoadStatus showLoading={!frameReady} visual {...media} requiresClick={false} onPause={media.pause} onRetry={media.retry} onPlay={() => media.play()} />}
  </>;
}

export default function RecoverableVideoPreview(props) {
  return <VideoPreviewSession key={JSON.stringify([props.src, props.poster])} {...props} />;
}
