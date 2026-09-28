/** 分析与原生播放独立：跨域或解码失败不影响声音；仅播放期间刷新柱条。 */
import { useEffect, useRef } from 'react';
import { buildAudioLevels, getAudioBars } from './CanvasAudioWaveform';

const MAX_BYTES = 32 * 1024 * 1024;
const MAX_DURATION = 600;

export function useCanvasAudioWaveform({ url, playing, audioRef }) {
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
        const bytes = await response.arrayBuffer();
        if (disposed || bytes.byteLength > MAX_BYTES) return;
        const context = new OfflineContext(1, 1, 22050);
        const buffer = await context.decodeAudioData(bytes);
        if (!disposed && buffer.duration <= MAX_DURATION) analysisRef.current = buildAudioLevels(buffer);
      } catch {
        // 文件不允许跨域读取或不能解码时保留静态基线，不连接或劫持播放源。
      }
    }

    function paint() {
      const bars = getAudioBars(analysisRef.current, audio.currentTime);
      const elements = waveformRef.current?.children;
      if (!elements) return;
      bars.forEach((height, index) => { if (elements[index]) elements[index].style.height = `${height}px`; });
    }

    function tick(timestamp) {
      if (disposed || audio.paused || audio.ended) return;
      if (timestamp - lastPaint >= 33) { paint(); lastPaint = timestamp; }
      frame = requestAnimationFrame(tick);
    }

    function start() {
      if (!pending) pending = loadAnalysis();
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(tick);
    }
    function stop() { cancelAnimationFrame(frame); }
    function finish() { stop(); paint(); }

    if (!audio) return undefined;
    audio.addEventListener('play', start);
    audio.addEventListener('pause', stop);
    audio.addEventListener('ended', finish);
    audio.addEventListener('seeked', paint);
    audio.addEventListener('error', stop);
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
    };
  }, [url, audioRef]);

  return { waveformRef, active: playing };
}
