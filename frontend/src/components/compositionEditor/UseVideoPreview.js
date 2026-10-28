import { useCallback, useEffect, useRef, useState } from 'react';
import { apiCompositionPreview } from '../../api/CompositionPreview';

/** 片段独立取消，刷新签名后重试，不退回原片；卸载回收全部计时器。 */
export function useVideoPreview(assetId) {
  const [generation, setGeneration] = useState(0);
  const [state, setState] = useState({ assetId, status: 'loading', data: null });
  const operation = useRef(null);
  useEffect(() => {
    if (!assetId) return undefined;
    const controller = new AbortController();
    let timer, attempt = 0, requesting = false, created = false, retryScheduled = false;
    let start = null, lastData = null;
    const update = (value) => { if (!controller.signal.aborted) setState({ ...value, assetId }); };
    const fail = (error) => update({ status: 'failed', error: error?.message || '预览视频暂不可用', data: lastData });
    const schedule = (error) => {
      if (controller.signal.aborted || retryScheduled) return;
      clearTimeout(timer);
      if (attempt >= 3) { fail(error); return; }
      retryScheduled = true;
      const delay = [1000, 2000, 4000][attempt++];
      update({ status: 'loading', data: lastData });
      timer = setTimeout(request, delay);
    };
    async function request() {
      if (requesting || controller.signal.aborted) return;
      retryScheduled = false;
      requesting = true;
      start ??= Date.now();
      const deadline = AbortSignal.timeout(Math.max(1, 60000 - (Date.now() - start)));
      const signal = AbortSignal.any([controller.signal, deadline]);
      try {
        let data = await apiCompositionPreview(assetId, { signal });
        if ((data.preview.status === 'pending' || data.preview.status === 'failed') && !created) {
          created = true;
          data = await apiCompositionPreview(assetId, { signal, create: true });
        }
        if (controller.signal.aborted) return;
        if (data.preview.status === 'ready') { lastData = data; start = null; update({ status: 'ready', data, attempt }); }
        else if (data.preview.status === 'failed') fail(new Error(data.preview.error?.message));
        else if (Date.now() - start >= 60000) fail(new Error('预览视频处理超时'));
        else { update({ status: 'processing', data }); timer = setTimeout(request, Math.min(3000, 60000 - (Date.now() - start))); }
      } catch (error) { if (!controller.signal.aborted) { if (deadline.aborted) fail(new Error('预览视频处理超时')); else schedule(error); } }
      finally { requesting = false; }
    }
    operation.current = schedule;
    update({ status: 'loading', data: null });
    request();
    return () => { controller.abort(); clearTimeout(timer); operation.current = null; };
  }, [assetId, generation]);
  const retry = useCallback(() => setGeneration((n) => n + 1), []);
  const mediaError = useCallback(() => operation.current?.(new Error('预览视频加载失败')), []);
  return { ...state, ...(state.assetId !== assetId ? { status: assetId ? 'loading' : 'idle', data: null } : {}), retry, mediaError };
}
