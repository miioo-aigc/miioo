/** 逐任务持久化；旧记录只读兼容，独立任务互不封锁。 */
export function createCreationPendingStore(getStorage) {
  const prefix = 'miioo_creation_task:';
  const memory = new Map();
  const active = new Set();
  const key = task => prefix + JSON.stringify([String(task.ownerId), task.genId]);
  const valid = task => task && typeof task.genId === 'string'
    && ['image', 'video', 'dubbing', 'music'].includes(task.genType)
    && Number.isSafeInteger(task.count) && task.count > 0;
  const read = () => {
    const records = new Map();
    try {
      const storage = getStorage();
      try {
        const legacy = JSON.parse(storage.getItem('miioo_pending_tasks') || '[]');
        if (Array.isArray(legacy)) for (const task of legacy) {
          if (valid(task)) records.set(key(task), task);
        }
      } catch { /* 损坏旧数据保留，不阻断独立任务。 */ }
      for (let i = 0; i < storage.length; i++) {
        const id = storage.key(i);
        if (!id?.startsWith(prefix)) continue;
        try {
          const task = JSON.parse(storage.getItem(id));
          if (task?.finished) records.delete(id);
          else if (valid(task)) records.set(id, task);
        } catch { /* 单条损坏不影响其他任务。 */ }
      }
    } catch { /* 存储不可用时保持当前页内存任务。 */ }
    for (const [id, task] of memory) {
      if (task.finished) records.delete(id);
      else records.set(id, task);
    }
    return records;
  };
  const save = task => {
    const id = key(task);
    memory.set(id, task);
    try {
      const raw = JSON.stringify(task);
      getStorage().setItem(id, raw);
      if (getStorage().getItem(id) === raw) memory.delete(id);
    } catch { /* 内存保留任务；不得封锁独立新生成。 */ }
  };
  return {
    list(ownerId) {
      return [...read().values()].filter(task => ownerId != null && String(task.ownerId) === String(ownerId));
    },
    assertReady(ownerId) {
      if (ownerId == null || ownerId === '') throw new Error('请先登录后再生成');
    },
    save,
    // 终态标记覆盖旧整表中的记录，不改写其他标签页的任务。
    remove(ownerId, genId) { save({ ownerId, genId, finished: true }); },
    setActive(ownerId, genId, value) {
      const id = key({ ownerId, genId });
      if (value) active.add(id); else active.delete(id);
    },
    isActive(ownerId, genId) { return active.has(key({ ownerId, genId })); },
  };
}

export const creationPendingStore = createCreationPendingStore(() => localStorage);
