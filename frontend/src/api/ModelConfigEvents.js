// 配置写入后通知已挂载消费者；事件不携带密钥或模型数据。
const listeners = new Set();
export function subscribeModelConfig(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export function publishModelConfig(generation) {
  for (const listener of listeners) listener(generation);
}
