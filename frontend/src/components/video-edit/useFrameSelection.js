import { useCallback, useEffect, useRef, useState } from 'react';
import { downloadBlobWithFeedback } from '../../utils/downloadFeedback';
import { frameAtTime } from './FrameIndex';

export default function useFrameSelection(url, canvasRef, { onExport } = {}) {
  const worker = useRef(null);
  const sequence = useRef(0);
  const target = useRef(0);
  const timer = useRef(null);
  const exportHandler = useRef(onExport);
  const [times, setTimes] = useState([]);
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [dimensions, setDimensions] = useState(null);

  useEffect(() => { exportHandler.current = onExport; }, [onExport]);

  useEffect(() => {
    const decoder = new Worker(new URL('./FrameDecoderWorker.js', import.meta.url), { type: 'module' });
    worker.current = decoder;
    let watchdog;
    const wait = () => {
      clearTimeout(watchdog);
      watchdog = setTimeout(() => {
        setError('视频处理超时，请关闭后重试');
        setBusy(true);
        setExporting(false);
        decoder.terminate();
        worker.current = null;
      }, 30000);
    };
    wait();
    decoder.onmessage = ({ data }) => {
      if (data.type === 'ready') {
        setTimes(data.times);
        decoder.postMessage({ type: 'seek', index: 0, id: sequence.current });
        wait();
      } else if (data.type === 'frame') {
        if (data.id === sequence.current) {
          const canvas = canvasRef.current;
          if (canvas) {
            canvas.width = data.bitmap.width;
            canvas.height = data.bitmap.height;
            canvas.getContext('2d').drawImage(data.bitmap, 0, 0);
          }
          setDimensions({ width: data.width, height: data.height });
          setBusy(false);
          clearTimeout(watchdog);
        }
        data.bitmap.close();
      } else if (data.type === 'export') {
        if (data.purpose === 'prepare') exportHandler.current?.(data.blob, data.index);
        else downloadBlobWithFeedback(data.blob, `视频选帧-${data.index + 1}.png`).catch(() => {});
        setExporting(false);
        clearTimeout(watchdog);
      } else if (data.type === 'error' && (data.id == null || data.id === sequence.current)) {
        setError(data.message);
        setBusy(true);
        setExporting(false);
        clearTimeout(watchdog);
      }
    };
    decoder.onerror = () => {
      setError('视频解码异常，请使用新版电脑浏览器重试');
      setBusy(true);
      setExporting(false);
      clearTimeout(watchdog);
      decoder.terminate();
      worker.current = null;
    };
    decoder.postMessage({ type: 'open', url, baseUrl: document.baseURI });
    worker.current.wait = wait;
    return () => {
      clearTimeout(timer.current);
      clearTimeout(watchdog);
      decoder.terminate();
      worker.current = null;
    };
  }, [url, canvasRef]);

  const select = useCallback((next) => {
    if (!times.length || exporting || !worker.current) return;
    const value = Math.max(0, Math.min(times.length - 1, next));
    target.current = value;
    setIndex(value);
    setBusy(true);
    setError('');
    const id = ++sequence.current;
    clearTimeout(timer.current);
    worker.current?.wait();
    timer.current = setTimeout(() => worker.current?.postMessage({ type: 'seek', index: value, id }), 70);
  }, [times.length, exporting]);

  const step = useCallback((direction) => select(target.current + direction), [select]);
  function seek(time) { select(frameAtTime(times, time)); }
  function download() {
    if (busy || exporting || error) return;
    setExporting(true);
    worker.current?.wait();
    worker.current?.postMessage({ type: 'export', index });
  }
  function exportFrame() {
    if (busy || exporting || error) return;
    setExporting(true);
    worker.current?.wait();
    worker.current?.postMessage({ type: 'export', index, purpose: 'prepare' });
  }
  return { times, index, busy, exporting, error, dimensions, step, seek, download, exportFrame };
}
