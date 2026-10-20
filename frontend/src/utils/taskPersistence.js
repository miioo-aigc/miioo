/** 共用生成任务存储：异常不能当作空列表；未落盘编号仅在本会话保留。 */
const STORAGE_KEY = 'miioo:pending_tasks';
const TYPES = new Set(['video', 'image', 'storyboard', 'subject-single', 'batch-subject']);
const hasId = (value) => typeof value === 'string' && value.trim().length > 0;
const sameId = (a, b) => String(a) === String(b);
const identity = (task) => JSON.stringify([task.ownerId ?? null, task.projectId, task.taskId]);

export function createTaskPersistence(getStorage) {
  const unsaved = new Map();
  const uncleared = new Set();
  const failure = (message) => Object.assign(new Error(`${message}；请勿重复生成，请先核对原任务（未保存编号仅在当前会话保留）`), { code: 'TASK_STORAGE' });

  function validate(tasks) {
    if (!Array.isArray(tasks) || tasks.some((task) => (
      !task || typeof task !== 'object' || Array.isArray(task)
      || !hasId(task.projectId) || !hasId(task.taskId) || !TYPES.has(task.type)
      || typeof task.episodeId !== 'string'
      || (task.ownerId != null && !hasId(task.ownerId))
      || (['image', 'video'].includes(task.type) && !hasId(task.shotId))
      || (task.type === 'storyboard' && !hasId(task.episodeId))
      || (task.type === 'subject-single' && (!hasId(task.subjectId) || !['char', 'scene', 'prop'].includes(task.tab)))
      || (task.type === 'batch-subject' && (!['char', 'scene', 'prop'].includes(task.tab)
        || !Array.isArray(task.subjectIds) || task.subjectIds.some((id) => !hasId(id))
        || (task.expectedSubjectIds != null && (!Array.isArray(task.expectedSubjectIds)
          || task.expectedSubjectIds.some((id) => !task.subjectIds.includes(id))))))
      || (task.submissionUnknown != null && typeof task.submissionUnknown !== 'boolean')
    ))) throw failure('任务记录结构异常');
    if (new Set(tasks.map(identity)).size !== tasks.length) throw failure('任务记录存在重复编号');
    return tasks;
  }

  function readAll() {
    let raw;
    try { raw = getStorage().getItem(STORAGE_KEY); }
    catch { throw failure('任务记录读取失败'); }
    if (raw === null) return [];
    let tasks;
    try { tasks = JSON.parse(raw); }
    catch { throw failure('任务记录已损坏'); }
    return validate(tasks);
  }

  function merged() {
    const tasks = new Map(readAll().map((task) => [identity(task), task]));
    for (const [key, task] of unsaved) tasks.set(key, task);
    return [...tasks.values()];
  }

  function writeAll(tasks) {
    const raw = JSON.stringify(tasks);
    try {
      const storage = getStorage();
      storage.setItem(STORAGE_KEY, raw);
      if (storage.getItem(STORAGE_KEY) !== raw) throw new Error('读回不一致');
    } catch { throw failure('任务记录保存或清理失败'); }
    unsaved.clear();
  }

  function getPendingTasks(projectId, episodeId) {
    return merged().filter((task) => sameId(task.projectId, projectId) && sameId(task.episodeId, episodeId));
  }

  // 付费提交前探测读写；旧无账号记录保留且阻止该项目继续生成。
  function assertPendingTaskStorageReady(projectId, ownerId) {
    if (!hasId(projectId) || !hasId(ownerId)) throw failure('登录或项目信息尚未就绪');
    const tasks = merged();
    if (tasks.some((task) => sameId(task.projectId, projectId) && !task.ownerId)) {
      throw failure('当前项目存在无法确认账号归属的旧任务');
    }
    if (unsaved.size || uncleared.size) throw failure('仍有任务编号未保存或清理未确认，请重新进入页面恢复查询');
    writeAll(tasks);
  }

  function addPendingTask(projectId, record) {
    const task = { ...record, projectId, createdAt: record.createdAt ?? Date.now() };
    if (!hasId(task.ownerId) || !hasId(task.taskId)) throw failure('新增任务归属或编号不完整');
    validate([task]);
    const key = identity(task);
    // 先在会话中保留编号：即使磁盘此时损坏，也不能遗失已受理任务。
    unsaved.set(key, task);
    writeAll(merged());
  }

  function removePendingTask(projectId, taskId, ownerId) {
    if (!hasId(ownerId)) throw failure('清理任务缺少账号归属');
    const key = identity({ projectId, taskId, ownerId });
    let original;
    try {
      const tasks = merged();
      original = tasks.find((task) => identity(task) === key);
      const remaining = tasks.filter((task) => !(sameId(task.projectId, projectId)
        && sameId(task.taskId, taskId) && sameId(task.ownerId, ownerId)));
      writeAll(remaining);
      uncleared.delete(key);
    } catch (error) {
      if (original) unsaved.set(key, original);
      uncleared.add(key);
      throw error;
    }
  }

  function clearProjectPendingTasks(projectId, ownerId) {
    assertPendingTaskStorageReady(projectId, ownerId);
    const tasks = merged();
    const removed = tasks.filter((task) => sameId(task.projectId, projectId) && sameId(task.ownerId, ownerId));
    try {
      writeAll(tasks.filter((task) => !removed.includes(task)));
    } catch (error) {
      for (const task of removed) {
        unsaved.set(identity(task), task);
        uncleared.add(identity(task));
      }
      throw error;
    }
  }

  return { addPendingTask, removePendingTask, getPendingTasks, clearProjectPendingTasks, assertPendingTaskStorageReady };
}

const persistence = createTaskPersistence(() => localStorage);
export const { addPendingTask, removePendingTask, getPendingTasks, clearProjectPendingTasks, assertPendingTaskStorageReady } = persistence;
