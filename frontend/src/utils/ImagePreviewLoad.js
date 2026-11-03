const IMAGE_READY = 'miioo-image-preview-ready';

/** 页面内成功通知，不缓存资源地址或跨账号持久化。 */
export function reportImagePreviewReady(url, network = window) {
  const event = new Event(IMAGE_READY);
  event.imageUrl = url;
  network.dispatchEvent(event);
}

/** 有界等待和代次隔离；全自动恢复由调用方显式开启。 */
export function createImagePreviewLoad({ src, fallbackSrc, resolveSrc, onChange, timeoutMs = 30000, network = window, automaticRecovery = false, retryDelays = [800, 2400], recoveryCooldownMs = 30000 }) {
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
  let retries = 0;
  let lastWake = -Infinity;
  let queued = false;
  const document = network.document;
  function schedule(delay) {
    if (queued || stopped) return;
    queued = true;
    recoveryTimer = setTimeout(() => {
      queued = false;
      if (network.navigator?.onLine !== false) start();
    }, delay + Math.random() * 400);
  }
  function wake(url) {
    if (stopped || status !== 'error' || network.navigator?.onLine === false || Date.now() - lastWake < recoveryCooldownMs) return;
    lastWake = Date.now();
    retries = 0;
    source = url || src;
    clearTimeout(recoveryTimer);
    queued = false;
    schedule(150);
  }
  function release() {
    clearTimeout(timer);
    current?.abort();
    if (blobUrl) URL.revokeObjectURL(blobUrl);
    blobUrl = undefined;
  }
  function recover() {
    if (automaticRecovery) {
      if (network.navigator?.onLine !== false && retries < retryDelays.length) schedule(retryDelays[retries++]);
      return;
    }
    if (stopped || autoUsed || !recoveryPending || status !== 'error' || network.navigator?.onLine === false) return;
    autoUsed = true;
    recoveryPending = false;
    recoveryTimer = setTimeout(() => start(), 150 + Math.random() * 850);
  }
  function start() {
    if (stopped) return;
    clearTimeout(recoveryTimer);
    release();
    queued = false;
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
      } else {
        publish(resolved);
        if (automaticRecovery) reportImagePreviewReady(source, network);
      }
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
    if (automaticRecovery) { wake(); return; }
    if (!wasOffline || autoUsed) return;
    wasOffline = false;
    recoveryPending = true;
    recover();
  }
  network.addEventListener('offline', offline);
  network.addEventListener('online', online);
  function visible() { if (document?.visibilityState === 'visible') wake(); }
  function focused() { if (document?.visibilityState !== 'hidden') wake(); }
  function ready(event) {
    if (event.imageUrl === src || event.imageUrl === fallbackSrc) wake(event.imageUrl);
  }
  if (automaticRecovery) {
    network.addEventListener('focus', focused);
    network.addEventListener(IMAGE_READY, ready);
    document?.addEventListener('visibilitychange', visible);
  }
  return {
    start,
    retry() { if (status === 'error') start(); },
    dispose() {
      stopped = true;
      release();
      clearTimeout(recoveryTimer);
      network.removeEventListener('offline', offline);
      network.removeEventListener('online', online);
      network.removeEventListener('focus', focused);
      network.removeEventListener(IMAGE_READY, ready);
      document?.removeEventListener('visibilitychange', visible);
    },
  };
}
