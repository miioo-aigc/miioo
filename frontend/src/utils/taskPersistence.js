/**
 * 生成任务持久化 —— 跨浏览器刷新的任务轮询恢复
 *
 * 当用户发起分镜图片/视频生成后，若刷新浏览器，组件内 async 轮询会丢失。
 * 本模块将待完成任务（taskId + shotId + projectId + episodeId）记入 localStorage，
 * 页面重新挂载时自动恢复轮询，保证生成任务不丢失。
 *
 * 存储结构：localStorage key: "miioo:pending_tasks"
 *   Array<{ projectId, taskId, shotId, episodeId, type: 'video'|'image', createdAt }>
 */

const STORAGE_KEY = 'miioo:pending_tasks';

function _readAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function _writeAll(tasks) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch {
    // quota 满了静默忽略
  }
}

/**
 * 新增一条待完成任务
 */
export function addPendingTask(projectId, { taskId, shotId, episodeId, type, ...extra }) {
  const all = _readAll();
  // 去重：同一 taskId 不重复添加
  if (all.some((t) => t.taskId === taskId)) return;
  all.push({ projectId, taskId, shotId, episodeId, type, createdAt: Date.now(), ...extra });
  _writeAll(all);
}

/**
 * 移除一条已完成/失败的任务
 */
export function removePendingTask(projectId, taskId) {
  const all = _readAll().filter((t) => !(t.projectId === projectId && t.taskId === taskId));
  _writeAll(all);
}

/**
 * 读取指定项目 + 剧集下所有待完成的任务
 */
export function getPendingTasks(projectId, episodeId) {
  return _readAll().filter((t) => t.projectId === projectId && t.episodeId === episodeId);
}

/**
 * 清除指定项目全部待完成任务（切换项目时调用）
 */
export function clearProjectPendingTasks(projectId) {
  const all = _readAll().filter((t) => t.projectId !== projectId);
  _writeAll(all);
}
