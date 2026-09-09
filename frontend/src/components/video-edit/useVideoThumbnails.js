import { useEffect, useState } from 'react';

export default function useVideoThumbnails(url, total) {
  const [result, setResult] = useState({ url: '', frames: [], failed: false });
  useEffect(() => {
    if (!url || !total) return undefined;
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    canvas.width = 160;
    canvas.height = 90;
    const context = canvas.getContext('2d');
    const frames = [];
    let cancelled = false;
    let timer;
    video.muted = true;
    video.preload = 'auto';
    video.crossOrigin = 'anonymous';
    const fail = () => {
      if (!cancelled) setResult({ url, frames: [], failed: true });
      cancelled = true;
      video.onloadeddata = video.onseeked = video.onerror = null;
      clearTimeout(timer);
    };
    const seek = () => {
      clearTimeout(timer);
      timer = setTimeout(fail, 12000);
      video.currentTime = Math.min((frames.length + 0.5) / 24 * total / 10, video.duration - 0.001);
    };
    video.onloadeddata = seek;
    video.onerror = fail;
    video.onseeked = () => {
      if (cancelled) return;
      try {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        frames.push(canvas.toDataURL('image/jpeg', 0.7));
        if (frames.length < 24) seek();
        else { clearTimeout(timer); setResult({ url, frames, failed: false }); }
      } catch { fail(); }
    };
    timer = setTimeout(fail, 12000);
    video.src = url;
    return () => {
      cancelled = true;
      clearTimeout(timer);
      video.onloadeddata = video.onseeked = video.onerror = null;
      video.removeAttribute('src');
      video.load();
    };
  }, [url, total]);
  return result.url === url ? result : { frames: [], failed: false };
}
