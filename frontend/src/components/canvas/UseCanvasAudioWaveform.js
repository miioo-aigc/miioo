/** 分析与原生播放独立：跨域或解码失败不影响声音；仅播放期间刷新柱条。 */
import { useEffect, useRef } from 'react';
import { buildAudioLevels, getAudioBars } from './CanvasAudioWaveform';

const MAX_BYTES = 32 * 1024 * 1024;
const MAX_DURATION = 600;

export function useCanvasAudioWaveform({ url, playing, audioRef, centered = false }) {
  const waveformRef = useRef(null);
  const analysisRef = useRef(null);

  useEffect(() => {
    const controller = new AbortController();
    const audio = audioRef.current;
    let pending = null;
    let disposed = false;
    let frame = 0;
    let lastPaint = 0;
    analysisRef.current = null;

    async function loadAnalysis() {
      try {
        const OfflineContext = window.OfflineAudioContext || window.webkitOfflineAudioContext;
        if (!OfflineContext || !url || audio.duration > MAX_DURATION) return;
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok || Number(response.headers.get('content-length')) > MAX_BYTES) return;
        if (!response.body) return;
        const reader = response.body.getReader();
        const chunks = [];
        let size = 0;
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (disposed || size > MAX_BYTES) { await reader.cancel(); return; }
          chunks.push(value);
        }
        const bytes = new Uint8Array(size);
        let offset = 0;
        for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
        if (disposed || bytes.byteLength > MAX_BYTES) return;
        const context = new OfflineContext(1, 1, 22050);
        const buffer = await context.decodeAudioData(bytes.buffer);
        if (!disposed && buffer.duration <= MAX_DURATION) analysisRef.current = buildAudioLevels(buffer);
      } catch {
        // 文件不允许跨域读取或不能解码时保留静态基线，不连接或劫持播放源。
      }
    }

    function paint() {
      const silent = audio.paused || audio.ended || audio.muted || audio.readyState < 3;
      const elements = waveformRef.current?.children;
      if (!elements) return;
      const bars = getAudioBars(centered && silent ? null : analysisRef.current, audio.currentTime, elements.length);
      bars.forEach((height, index) => {
        if (!elements[index]) return;
        if (centered) {
          const level = Math.min(1, Math.max(0, (height - 3) / 17) * audio.volume);
          const distance = Math.abs(index - (elements.length - 1) / 2);
          const envelope = Math.exp(-(distance ** 2) / 10);
          const target = 6 + 108 * envelope * level;
          elements[index].style.height = target + 'px';
        } else elements[index].style.height = `${height}px`;
      });
    }

    function tick(timestamp) {
      if (disposed || (centered && document.hidden)) return;
      if (audio.paused || audio.ended) return;
      if (timestamp - lastPaint >= 33) { paint(); lastPaint = timestamp; }
      frame = requestAnimationFrame(tick);
    }

    function start() {
      if (!pending && !analysisRef.current) pending = loadAnalysis().finally(() => { pending = null; });
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(tick);
    }
    function stop() {
      cancelAnimationFrame(frame);
      if (centered && !disposed) paint();
    }
    function finish() { stop(); paint(); }
    function visibility() { if (document.hidden) stop(); else if (!audio.paused && !audio.ended) start(); }

    if (!audio) return undefined;
    audio.addEventListener('play', start);
    audio.addEventListener('pause', stop);
    audio.addEventListener('ended', finish);
    audio.addEventListener('seeked', paint);
    audio.addEventListener('error', stop);
    if (centered) document.addEventListener('visibilitychange', visibility);
    if (!audio.paused) start();
    return () => {
      disposed = true;
      controller.abort();
      stop();
      analysisRef.current = null;
      audio.removeEventListener('play', start);
      audio.removeEventListener('pause', stop);
      audio.removeEventListener('ended', finish);
      audio.removeEventListener('seeked', paint);
      audio.removeEventListener('error', stop);
      if (centered) document.removeEventListener('visibilitychange', visibility);
    };
  }, [url, audioRef, centered]);

  return { waveformRef, active: playing };
}
