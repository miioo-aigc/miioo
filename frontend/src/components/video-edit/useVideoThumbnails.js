import { useEffect, useState } from 'react';
import { toVideoMediaUrl } from '../../utils/VideoMediaUrl';

const thumbnailCache = new Map();
const CACHE_LIMIT = 6;
const WAIT_MS = 5 * 60 * 1000;

export default function useVideoThumbnails(url, total, { trackWidth = 0, trackHeight = 0, start = 0, adaptive = false } = {}) {
  const key = JSON.stringify([url, total, trackWidth, trackHeight, start, adaptive]);
  const [result, setResult] = useState({ key: '', frames: [], failed: false });
  useEffect(() => {
    if (!url || !total || (adaptive && (!trackWidth || !trackHeight))) return undefined;
    if (thumbnailCache.has(key)) {
      const cached = thumbnailCache.get(key);
      thumbnailCache.delete(key);
      thumbnailCache.set(key, cached);
      return undefined;
    }
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    let count = 24;
    let aspectRatio = 16 / 9;
    const context = canvas.getContext('2d');
    const frames = [];
    let cancelled = false;
    let timer;
    video.muted = true;
    video.preload = 'auto';
    video.crossOrigin = 'anonymous';
    const release = () => {
      video.onloadeddata = video.onseeked = video.onerror = null;
      clearTimeout(timer);
      video.removeAttribute('src');
      video.load();
    };
    const fail = () => {
      if (!cancelled) setResult({ key, frames: [...frames], aspectRatio, failed: true });
      cancelled = true;
      release();
    };
    const seek = () => {
      clearTimeout(timer);
      timer = setTimeout(fail, WAIT_MS);
      const next = Math.max(0, Math.min(start + (frames.length + 0.5) / count * (total / 10 - start), video.duration - 0.001));
      if (video.currentTime === next && video.readyState >= 2) queueMicrotask(capture);
      else video.currentTime = next;
    };
    video.onloadeddata = () => {
      video.onloadeddata = null;
      if (!context || !Number.isFinite(video.duration) || video.duration <= 0 || !video.videoWidth || !video.videoHeight) { fail(); return; }
      aspectRatio = video.videoWidth / video.videoHeight;
      const scale = Math.min(160 / video.videoWidth, 160 / video.videoHeight);
      canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
      canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
      if (adaptive) count = Math.max(1, Math.ceil(trackWidth / (trackHeight * aspectRatio)));
      seek();
    };
    video.onerror = fail;
    const capture = () => {
      if (cancelled) return;
      try {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        frames.push(canvas.toDataURL('image/jpeg', 0.7));
        const nextResult = { key, frames: [...frames], aspectRatio, failed: false };
        setResult(nextResult);
        if (frames.length < count) seek();
        else {
          thumbnailCache.set(key, nextResult);
          while (thumbnailCache.size > CACHE_LIMIT) thumbnailCache.delete(thumbnailCache.keys().next().value);
          cancelled = true;
          release();
        }
      } catch { fail(); }
    };
    video.onseeked = capture;
    timer = setTimeout(fail, WAIT_MS);
    video.src = toVideoMediaUrl(url);
    return () => {
      cancelled = true;
      release();
    };
  }, [url, total, key, trackWidth, trackHeight, start, adaptive]);
  return thumbnailCache.get(key) || (result.key === key ? result : { frames: [], failed: false });
}
