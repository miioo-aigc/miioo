/** 图片预览会话：有界等待、代次隔离及一次联网恢复。 */
export function createImagePreviewLoad({ src, fallbackSrc, resolveSrc, onChange, timeoutMs = 30000, network = window }) {
  let stopped = false;
  let attempt = 0;
  let current;
  let timer;
  let recoveryTimer;
  let blobUrl;
  let status = 'loading';
  let source = src;
  let wasOffline = network.navigator?.onLine === false;
  let recoveryPending = false;
  let autoUsed = false;
  function release() {
    clearTimeout(timer);
    current?.abort();
    if (blobUrl) URL.revokeObjectURL(blobUrl);
    blobUrl = undefined;
  }
  function recover() {
    if (stopped || autoUsed || !recoveryPending || status !== 'error' || network.navigator?.onLine === false) return;
    autoUsed = true;
    recoveryPending = false;
    recoveryTimer = setTimeout(() => start(), 150 + Math.random() * 850);
  }
  function start() {
    if (stopped) return;
    clearTimeout(recoveryTimer);
    release();
    const id = ++attempt;
    const controller = new AbortController();
    current = controller;
    status = 'loading';
    let resolved = '';
    const active = () => !stopped && id === attempt && !controller.signal.aborted;
    const publish = (resolvedSrc = '', message = '') => onChange({
      attempt: id, status, resolvedSrc, message,
      onLoad: () => finish('loaded'), onError: () => finish('error'),
    });
    function finish(next, message = '图片加载失败') {
      if (!active() || status !== 'loading') return;
      clearTimeout(timer);
      status = next;
      if (next === 'error') {
        controller.abort();
        if (fallbackSrc && source !== fallbackSrc) { source = fallbackSrc; start(); return; }
        publish('', message);
        recover();
      } else publish(resolved);
    }
    publish();
    timer = setTimeout(() => finish('error', '图片加载超时'), timeoutMs);
    Promise.resolve().then(() => {
      if (!active()) return null;
      return resolveSrc ? resolveSrc(source, { signal: controller.signal }) : source;
    }).then(url => {
      if (!active()) {
        if (resolveSrc && typeof url === 'string' && url.startsWith('blob:')) URL.revokeObjectURL(url);
        return;
      }
      if (!url) { finish('error'); return; }
      resolved = url;
      if (resolveSrc && url.startsWith('blob:')) blobUrl = url;
      publish(url);
    }).catch(() => finish('error'));
  }
  function offline() { wasOffline = true; }
  function online() {
    if (!wasOffline || autoUsed) return;
    wasOffline = false;
    recoveryPending = true;
    recover();
  }
  network.addEventListener('offline', offline);
  network.addEventListener('online', online);
  return {
    start,
    retry() { if (status === 'error') start(); },
    dispose() {
      stopped = true;
      release();
      clearTimeout(recoveryTimer);
      network.removeEventListener('offline', offline);
      network.removeEventListener('online', online);
    },
  };
}
