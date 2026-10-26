// 限制整个读取过程（含鉴权等待、响应体读取），避免仅取消 fetch 后仍悬挂。
export async function readCreationHistoryPage(load, { signal, timeoutMs = 30000 } = {}) {
  const controller = new AbortController();
  let timer;
  let onAbort;
  const stopped = new Promise((_, reject) => {
    onAbort = () => {
      controller.abort();
      const error = new Error('读取已取消');
      error.name = 'AbortError';
      reject(error);
    };
    signal?.addEventListener('abort', onAbort, { once: true });
    if (signal?.aborted) onAbort();
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error('创作资产读取超时，请重试'));
    }, timeoutMs);
  });
  try {
    const data = await Promise.race([
      stopped,
      Promise.resolve().then(() => {
        if (controller.signal.aborted) throw new Error('读取已取消');
        return load(controller.signal);
      }),
    ]);
    const list = Array.isArray(data) ? data : (data?.list ?? data?.items ?? data?.data);
    if (!Array.isArray(list)) throw new Error('创作资产返回数据异常，请重试');
    return data;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}
