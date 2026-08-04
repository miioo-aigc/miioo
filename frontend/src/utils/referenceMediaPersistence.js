/**
 * @file referenceMediaPersistence.js
 *
 * 参考素材持久化队列：同一业务对象只提交最新快照，并保证请求按顺序完成。
 * 不负责接口地址和业务字段，调用方通过 persist 注入具体 API。
 */

export function createLatestPersistenceQueue(persist) {
  let running = false;
  let pending = null;
  let sequence = 0;
  let settled = Promise.resolve();

  async function drain() {
    if (running) return settled;
    running = true;
    settled = (async () => {
      let firstError = null;
      let lastResult;
      while (pending) {
        const next = pending;
        pending = null;
        const currentSequence = next.sequence;
        try {
          lastResult = await persist(next.value, currentSequence);
        } catch (error) {
          // 当前请求失败时仍继续提交队列中更新的快照，避免一次失败永久阻塞后续删除/绑定。
          firstError ||= error;
        }
      }
      if (firstError) throw firstError;
      return lastResult;
    })().finally(() => {
      running = false;
    });
    return settled;
  }

  return {
    enqueue(value) {
      const next = { value, sequence: ++sequence };
      pending = next;
      return drain();
    },
    get sequence() {
      return sequence;
    },
    wait() {
      return settled;
    },
  };
}
