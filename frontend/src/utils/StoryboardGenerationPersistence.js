// 首页智能分镜专用：存储异常不能被当成“没有任务”。不删除或覆盖无法识别的原始记录。
export function createStoryboardGenerationPersistence(getStorage) {
  const prefix = 'miioo:pending_storyboard_generation:';
  const unsaved = new Map();
  const blocked = (reason) => ({ status: 'unknown', blocked: true, error: `${reason}，请先核对后台任务，勿重复生成` });
  const keyFor = (projectId, ownerId) => `${prefix}${ownerId}:${projectId}`;
  const valid = (value, projectId, ownerId) => value && typeof value === 'object'
    && !Array.isArray(value) && String(value.ownerId) === String(ownerId)
    && (value.projectId == null || String(value.projectId) === String(projectId))
    && ['submitting', 'running', 'unknown', 'failed'].includes(value.status)
    && (value.error == null || typeof value.error === 'string')
    && (value.taskId == null || (typeof value.taskId === 'string' && value.taskId.trim().length > 0))
    && (value.status !== 'running' || Boolean(value.taskId));

  function read(projectId, ownerId) {
    if (!projectId || !ownerId) return blocked('任务归属尚未确认');
    const key = keyFor(projectId, ownerId);
    // 本次提交已经拿到的编号优先于未能更新的磁盘占位，仅限相同账号和项目。
    if (unsaved.has(key)) return { ...unsaved.get(key) };
    try {
      const storage = getStorage();
      const raw = storage.getItem(key);
      if (raw !== null) {
        const value = JSON.parse(raw);
        return valid(value, projectId, ownerId) ? value : blocked('任务记录格式或归属异常');
      }
      if (storage.getItem(`${prefix}${projectId}`) !== null) return blocked('发现未确认账号归属的旧任务记录');
      return null;
    } catch {
      return blocked('任务记录无法读取');
    }
  }

  function write(projectId, ownerId, value) {
    const existing = read(projectId, ownerId);
    if (existing?.blocked) throw new Error(existing.error);
    const record = { ...value, ownerId, projectId };
    if (!valid(record, projectId, ownerId)) throw new Error('任务记录格式无效');
    const key = keyFor(projectId, ownerId);
    const raw = JSON.stringify(record);
    try {
      const storage = getStorage();
      storage.setItem(key, raw);
      if (storage.getItem(key) !== raw) throw new Error('任务记录写入校验失败');
      unsaved.delete(key);
    } catch {
      unsaved.set(key, record);
      throw new Error('任务记录保存失败，请勿重复生成，先核对后台任务');
    }
  }

  function clear(projectId, ownerId) {
    const existing = read(projectId, ownerId);
    if (existing?.blocked) throw new Error(existing.error);
    const key = keyFor(projectId, ownerId);
    try {
      const storage = getStorage();
      storage.removeItem(key);
      if (storage.getItem(key) !== null) throw new Error('任务记录清理校验失败');
      unsaved.delete(key);
    } catch {
      if (existing) unsaved.set(key, existing);
      throw new Error('任务记录清理失败，请先核对后台任务，勿重复生成');
    }
  }
  return { read, write, clear };
}
