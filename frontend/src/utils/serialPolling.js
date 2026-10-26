/** 串行轮询：运行代次隔离、单飞请求、页面隐藏暂停及错误退避。 */
export function createSerialPolling({ task, interval = 2000, onResult, onError, maxConsecutiveErrors = 5, errorBackoffMultiplier = 1.5, pauseWhenHidden = true }) {
  let running = false;
  let generation = 0;
  let inFlight = false;
  let timer = null;
  let errors = 0;
  let delay = interval;
  const visible = () => !pauseWhenHidden || !document.hidden;
  const clear = () => { if (timer !== null) clearTimeout(timer); timer = null; };
  function schedule() {
    clear();
    if (running && !inFlight && visible()) timer = setTimeout(poll, delay);
  }
  async function poll() {
    timer = null;
    if (!running || inFlight || !visible()) return;
    const version = generation;
    const current = () => running && version === generation;
    inFlight = true;
    try {
      const result = await task();
      if (!current()) return;
      errors = 0;
      delay = interval;
      onResult?.(result);
    } catch (error) {
      if (!current()) return;
      errors++;
      if (onError) onError(error);
      else console.error('[serialPolling] 轮询出错:', error);
      if (!current()) return;
      if (errors >= maxConsecutiveErrors) { stop(); return; }
      delay = Math.min(interval * Math.pow(errorBackoffMultiplier, errors), 60000);
    } finally {
      inFlight = false;
      schedule();
    }
  }
  function start() {
    if (running) return;
    running = true;
    generation++;
    errors = 0;
    delay = interval;
    if (pauseWhenHidden) document.addEventListener('visibilitychange', schedule);
    schedule();
  }
  function stop() {
    running = false;
    generation++;
    clear();
    if (pauseWhenHidden) document.removeEventListener('visibilitychange', schedule);
  }
  return { start, stop, wake: schedule, isRunning: () => running };
}
