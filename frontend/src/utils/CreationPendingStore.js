/** 创作任务独立账本；未知受理结果不能被当作失败清除。 */
export function createCreationPendingStore(getStorage) {
  const storageKey = 'miioo_pending_tasks';
  const unsaved = new Map();
  const key = task => JSON.stringify([String(task.ownerId), task.genId]);
  const failure = cause => new Error('创作任务记录异常，已暂停新生成；请保留当前页面和缓存，先核对原任务', { cause });
  const read = () => {
    const raw = getStorage().getItem(storageKey);
    const list = raw === null ? [] : JSON.parse(raw);
    if (!Array.isArray(list)) throw new Error('任务记录不是列表');
    const seen = new Set();
    for (const task of list) {
      if (!task || typeof task !== 'object' || typeof task.genId !== 'string' || !task.genId
        || !['image', 'video', 'dubbing', 'music'].includes(task.genType)
        || (task.tab != null && !['image', 'video', 'dubbing', 'music'].includes(task.tab))
        || (task.ownerId != null && !['string', 'number'].includes(typeof task.ownerId))
        || !Number.isSafeInteger(task.count) || task.count < 1
        || (task.taskId != null && (typeof task.taskId !== 'string' || !task.taskId))
        || (task.taskIds != null && (!Array.isArray(task.taskIds) || !task.taskIds.length
          || task.taskIds.some(id => typeof id !== 'string' || !id)))) throw new Error('任务记录损坏');
      const id = key(task);
      if (seen.has(id)) throw new Error('任务记录重复');
      seen.add(id);
    }
    const merged = new Map(list.map(task => [key(task), task]));
    for (const [id, task] of unsaved) merged.set(id, task);
    return merged;
  };
  const write = next => {
    const raw = JSON.stringify([...next.values()]);
    getStorage().setItem(storageKey, raw);
    if (getStorage().getItem(storageKey) !== raw) throw new Error('任务写入未确认');
    unsaved.clear();
  };
  return {
    list(ownerId) {
      try { return [...read().values()].filter(task => ownerId != null && String(task.ownerId) === String(ownerId)); }
      catch (cause) { throw failure(cause); }
    },
    assertReady(ownerId) {
      try {
        if (ownerId == null || ownerId === '') throw new Error('缺少账号');
        const next = read();
        if (unsaved.size || [...next.values()].some(task => task.ownerId == null
          || (String(task.ownerId) === String(ownerId) && !task.taskId))) throw new Error('存在受理结果不明的任务');
        write(next);
      } catch (cause) { throw failure(cause); }
    },
    save(task) {
      try { const next = read(); next.set(key(task), task); write(next); }
      catch (cause) { unsaved.set(key(task), task); throw failure(cause); }
    },
    remove(ownerId, genId) {
      try { const next = read(); next.delete(key({ ownerId, genId })); write(next); }
      catch (cause) { throw failure(cause); }
    },
  };
}

export const creationPendingStore = createCreationPendingStore(() => localStorage);
