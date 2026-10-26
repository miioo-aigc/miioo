/** 单个媒体元素的加载/播放会话；恢复只重载；默认显式播放，静音预览允许由悬停继续。 */
export function createMediaPlaybackSession(media, { onChange, network = window, timeoutMs = 30000 } = {}) {
  let disposed = false;
  let version = 0;
  let timer;
  let recoveryTimer;
  let offline = network.navigator?.onLine === false;
  let recovered = false;
  let autoUsed = false;
  let requiresClick = false;
  let position = 0;
  let state = { status: 'idle', message: '', requiresClick: false };
  const handlers = {};
  const publish = (status, message = '') => {
    if (disposed) return;
    state = { status, message, requiresClick };
    onChange?.(state);
  };
  function clearWait() { clearTimeout(timer); timer = undefined; }
  function wait() {
    clearWait();
    publish('loading');
    timer = setTimeout(() => fail('媒体加载超时'), timeoutMs);
  }
  function recover() {
    if (!recovered || autoUsed || state.status !== 'error' || network.navigator?.onLine === false) return;
    autoUsed = true;
    recoveryTimer = setTimeout(reload, 150 + Math.random() * 850);
  }
  function fail(message = '媒体加载失败') {
    if (disposed) return;
    version++;
    clearWait();
    position = Number.isFinite(media.currentTime) ? media.currentTime : 0;
    requiresClick = true;
    publish('error', message);
    media.pause();
    recover();
  }
  function reload() {
    if (disposed) return;
    version++;
    clearTimeout(recoveryTimer);
    requiresClick = true;
    media.pause();
    wait();
    media.load();
  }
  function ready() {
    if (disposed || media.error || state.status === 'error') return;
    if (requiresClick) {
      clearWait();
      if (position > 0 && Number.isFinite(media.duration)) {
        try { media.currentTime = Math.min(position, media.duration); } catch { /* 不可定位时保留起点 */ }
        position = 0;
      }
      publish('ready', '已重新加载，点击播放');
    } else if (media.paused) { clearWait(); publish('ready'); }
  }
  async function play({ automatic = false, mutedFallback = false, hover = false } = {}) {
    if (disposed || (automatic && requiresClick && !(hover && media.muted))) return false;
    if (state.status === 'error') { reload(); return false; }
    clearTimeout(recoveryTimer);
    const id = ++version;
    requiresClick = false;
    wait();
    try {
      await media.play();
      if (disposed || id !== version) return false;
      clearWait();
      publish('playing');
      return true;
    } catch (error) {
      if (disposed || id !== version) return false;
      if (error.name === 'NotAllowedError' && mutedFallback && !media.muted) {
        media.muted = true;
        return play({ automatic, hover });
      }
      if (error.name === 'NotAllowedError') {
        clearWait(); requiresClick = true; publish('ready', '请点击播放');
      } else if (error.name === 'AbortError') {
        clearWait(); publish('paused');
      } else fail(error.name === 'NotSupportedError' ? '媒体格式不支持或地址不可用' : '媒体加载失败');
      return false;
    }
  }
  function pause() {
    version++;
    clearWait();
    clearTimeout(recoveryTimer);
    recovered = false;
    media.pause();
    if (state.status !== 'error') publish('paused');
  }
  const listen = (name, fn) => { handlers[name] = fn; media.addEventListener(name, fn); };
  listen('loadedmetadata', ready);
  listen('canplay', ready);
  listen('playing', () => {
    if (requiresClick || state.status === 'error') { media.pause(); return; }
    clearWait(); publish('playing');
  });
  listen('play', () => {
    if (state.status === 'error') { media.pause(); return; }
    requiresClick = false; wait();
  });
  listen('waiting', () => { if (!media.paused && state.status !== 'error') wait(); });
  listen('stalled', () => { if (!media.paused && state.status !== 'error' && !timer) wait(); });
  listen('pause', () => {
    if (state.status === 'error' || requiresClick) return;
    version++; clearWait(); publish('paused');
  });
  listen('ended', () => { version++; clearWait(); publish('paused'); });
  listen('error', () => fail(media.error?.code === 4 ? '媒体格式不支持或地址不可用' : '媒体加载失败'));
  const onOffline = () => { offline = true; };
  const onOnline = () => {
    if (!offline || autoUsed) return;
    offline = false; recovered = true; recover();
  };
  network.addEventListener('offline', onOffline);
  network.addEventListener('online', onOnline);
  return {
    play, pause, reload,
    start() { if (!disposed && media.readyState < 1) wait(); else ready(); },
    getState: () => state,
    dispose() {
      disposed = true; version++; clearWait(); clearTimeout(recoveryTimer);
      Object.entries(handlers).forEach(([name, fn]) => media.removeEventListener(name, fn));
      network.removeEventListener('offline', onOffline); network.removeEventListener('online', onOnline);
      media.pause();
    },
  };
}
