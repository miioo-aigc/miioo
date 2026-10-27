// 请求幂等与版本串行由 CanvasSaveSession 负责。
export function createCanvasAutosave({ schedule = setTimeout, cancel = clearTimeout, onError, onState = () => {} }) {
  let current;
  let saved;
  let persist;
  let writable = false;
  let timer;
  let running = null;
  let disposed = false;
  let state = 'idle';
  let statusTimer;
  let requests = 0;
  const publish = (next) => {
    if (disposed) return;
    cancel(statusTimer);
    statusTimer = undefined;
    state = next;
    onState(next);
  };
  queueMicrotask(() => { if (!disposed) onState(state); });
  const dirty = () => current !== undefined && (current !== saved || running !== null);
  const clear = () => { cancel(timer); timer = undefined; };
  const flush = async () => {
    clear();
    if (disposed) return false;
    if (running) return running;
    if (current === saved) return true;
    if (!writable) return false;
    running = Promise.resolve().then(() => disposed ? false : persist());
    try { return await running; }
    finally { running = null; }
  };
  const update = (key, canSave, save) => {
    if (disposed) return;
    persist = save;
    writable = canSave;
    if (current === undefined) saved = key;
    const changed = current !== key;
    current = key;
    if (changed || !canSave) clear();
    if (changed) publish(requests ? 'saving' : current === saved ? 'idle' : 'pending');
    if (current !== saved && canSave && timer === undefined) {
      timer = schedule(() => {
        timer = undefined;
        if (running) {
          running.finally(() => {
            if (!disposed) update(current, writable, persist);
          }).catch(() => {});
          return;
        }
        flush().catch((error) => { if (!disposed) onError(error); });
      }, 1000);
    }
  };
  return {
    dirty, flush, update,
    start() { if (!disposed) { requests++; publish('saving'); } },
    fail() { if (!disposed) { requests = Math.max(0, requests - 1); publish('error'); } },
    acknowledge(key) {
      if (disposed) return;
      saved = key;
      const completed = requests > 0;
      requests = Math.max(0, requests - 1);
      if (requests) publish('saving');
      else if (current !== undefined && current !== saved) publish('pending');
      else if (completed) {
        publish('success');
        statusTimer = schedule(() => { if (state === 'success') publish('idle'); }, 1000);
      }
    },
    dispose() { disposed = true; clear(); cancel(statusTimer); },
  };
}
