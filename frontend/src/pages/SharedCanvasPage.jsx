import { useEffect, useState } from 'react';
import { apiGetSharedCanvas } from '../api/canvas';
import { readCanvasShareDocument } from '../components/canvas/CanvasShareDocument';
import { buildCanvasShareLink, copyCanvasShareLink } from '../components/canvas/CanvasShareLink';
import SharedCanvasView from '../components/canvas/SharedCanvasView';
import { showGlobalToast } from '../stores/toastStore';

export default function SharedCanvasPage({ token }) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({ loading: true });
  const [copying, setCopying] = useState(false);
  const copy = async () => {
    if (copying) return;
    setCopying(true);
    try {
      await copyCanvasShareLink(buildCanvasShareLink(window.location.origin, token));
      showGlobalToast('链接已复制', 'success');
    } catch (error) { showGlobalToast(error.message || '复制失败', 'error'); }
    finally { setCopying(false); }
  };
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setState({ loading: true });
      try {
        if (!token) throw new Error('分享链接格式不正确');
        const payload = await apiGetSharedCanvas(token, { signal: controller.signal });
        const graph = readCanvasShareDocument(payload);
        if (!controller.signal.aborted) setState({ loading: false, title: typeof payload.title === 'string' ? payload.title : '', graph });
      } catch (error) {
        if (!controller.signal.aborted) setState({ loading: false, error: error.status === 404 || error.code === 'CANVAS_SHARE_NOT_FOUND'
          ? '分享链接已失效，或画布已停止分享' : error.message || '加载失败，请稍后重试' });
      }
    }
    load();
    return () => controller.abort();
  }, [token, attempt]);
  return <SharedCanvasView {...state} copying={copying} onCopy={copy} onRetry={() => setAttempt((value) => value + 1)} />;
}
