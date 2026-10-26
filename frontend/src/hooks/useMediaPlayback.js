import { useCallback, useEffect, useRef, useState } from 'react';
import { createMediaPlaybackSession } from '../utils/MediaPlaybackSession';

export function useMediaPlayback(mediaRef, src, { autoPlay = false, deferred = false, mutedFallback = false } = {}) {
  const sessionRef = useRef(null);
  const [snapshot, setSnapshot] = useState({ src, status: 'idle' });
  useEffect(() => {
    const media = mediaRef.current;
    if (!media || !src) return undefined;
    const session = createMediaPlaybackSession(media, { onChange: state => setSnapshot({ src, ...state }) });
    sessionRef.current = session;
    queueMicrotask(() => { if (!deferred) session.start(); if (autoPlay) void session.play({ automatic: true, mutedFallback }); });
    return () => { session.dispose(); if (sessionRef.current === session) sessionRef.current = null; };
  }, [mediaRef, src, autoPlay, deferred, mutedFallback]);
  const play = useCallback(options => sessionRef.current?.play(options), []);
  const pause = useCallback(() => sessionRef.current?.pause(), []);
  const retry = useCallback(() => sessionRef.current?.reload(), []);
  return { ...(snapshot.src === src ? snapshot : { status: 'idle' }), play, pause, retry };
}
