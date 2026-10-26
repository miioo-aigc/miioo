import { useEffect, useRef } from 'react';
import { useMediaPlayback } from '../../hooks/useMediaPlayback';
import MediaLoadStatus from '../feedback/MediaLoadStatus';

/** 资产库音视频展示壳；播放与弱网恢复复用媒体会话。 */
export default function AssetLibraryPlayer({ src, type = 'video', poster, label, autoPlay = false, muted = false, hovered, controls = true, onError, objectFit = 'contain' }) {
  const ref = useRef(null);
  const media = useMediaPlayback(ref, src, { autoPlay });
  const { play, pause } = media;
  const hoverRecoveryAttempted = useRef(false);
  useEffect(() => {
    if (typeof hovered !== 'boolean') return;
    if (hovered) void play({ automatic: true, hover: true });
    else { pause(); if (ref.current) ref.current.currentTime = 0; }
  }, [hovered, play, pause, src]);
  useEffect(() => {
    if (!hovered || media.status === 'error') hoverRecoveryAttempted.current = false;
    if (!hovered || !media.requiresClick || media.status !== 'ready' || hoverRecoveryAttempted.current) return;
    hoverRecoveryAttempted.current = true;
    void play({ automatic: true, hover: true });
  }, [hovered, media.status, media.requiresClick, play]);
  const Tag = type === 'audio' ? 'audio' : 'video';
  return <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <Tag ref={ref} src={src} poster={type === 'video' ? poster : undefined} controls={controls} muted={muted} playsInline preload="metadata" aria-label={label} onError={onError}
      style={{ width: '100%', ...(type === 'video' ? { height: '100%', objectFit } : {}) }} />
    <MediaLoadStatus visual showLoading={type !== 'audio'} {...media} requiresClick={typeof hovered === 'boolean' ? false : media.requiresClick} onPause={pause} onRetry={media.retry} onPlay={() => play()} />
  </div>;
}
