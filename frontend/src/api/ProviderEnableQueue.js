// 同账号同服务商串行写入，连续点击合并为最新意图；跨弹窗保留在途队列。
export function createProviderEnableQueue({ update, read, getGeneration }) {
  const queues = new Map();
  const keyFor = id => `${getGeneration()}:${id}`;
  return {
    has: id => queues.has(keyFor(id)),
    hasPending: () => [...queues.keys()].some(key => key.startsWith(`${getGeneration()}:`)),
    async wait() {
      const prefix = `${getGeneration()}:`;
      while ([...queues.keys()].some(key => key.startsWith(prefix))) {
        await Promise.all([...queues].filter(([key]) => key.startsWith(prefix)).map(([, entry]) => entry.promise));
      }
    },
    toggle(id, confirmed, onChange, onError) {
      const key = keyFor(id);
      const existing = queues.get(key);
      if (existing) {
        existing.desired = !existing.desired;
        existing.version += 1;
        existing.onChange = onChange;
        existing.onError = onError;
        onChange(existing.desired);
        return existing.promise;
      }
      const generation = getGeneration();
      const current = () => generation === getGeneration();
      const entry = { desired: !confirmed, confirmed, version: 1, onChange, onError };
      queues.set(key, entry);
      onChange(entry.desired);
      entry.promise = Promise.resolve().then(async () => {
        while (current()) {
          const version = entry.version;
          const desired = entry.desired;
          let error = false;
          let verified = false;
          try {
            const result = await update(id, { is_enabled: desired });
            if (result?.id !== id || typeof result.is_enabled !== 'boolean') throw new Error('状态响应异常');
            entry.confirmed = result.is_enabled;
            verified = true;
          } catch {
            if (!current()) return;
            error = true;
            try {
              const data = await read();
              const list = Array.isArray(data) ? data : (data?.items ?? data?.providers);
              const provider = Array.isArray(list) ? list.find(item => item.id === id) : null;
              if (typeof provider?.is_enabled !== 'boolean') throw new Error('核对失败');
              entry.confirmed = provider.is_enabled;
              verified = true;
            } catch { /* 保留最后确认状态，明确提示核对失败。 */ }
          }
          if (!current()) return;
          if (version !== entry.version) continue;
          entry.onChange(entry.confirmed);
          if (error) entry.onError(verified
            ? '服务商状态保存异常，已按服务器当前状态校正，请核对'
            : '服务商状态未能确认，已恢复最后确认状态，请重新打开配置核对');
          return;
        }
      }).finally(() => {
        if (queues.get(key) === entry) queues.delete(key);
      });
      return entry.promise;
    },
  };
}
