// 请求幂等与版本串行由 CanvasSaveSession 负责。
export function createCanvasAutosave({ schedule = setTimeout, cancel = clearTimeout, onError }) {
  let current;
  let saved;
  let persist;
  let writable = false;
  let timer;
  let running = null;
  let disposed = false;
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
    acknowledge(key) { if (!disposed) saved = key; },
    dispose() { disposed = true; clear(); },
  };
}
