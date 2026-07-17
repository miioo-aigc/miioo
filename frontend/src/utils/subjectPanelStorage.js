/**
 * 主体编辑面板会话缓存。
 * 仅负责 sessionStorage 读写，不读取 React 状态，也不触发页面副作用。
 */

const STORAGE_PREFIX = 'miioo:subject_panel:';

function getStorageKey(projectId) {
  return `${STORAGE_PREFIX}${projectId}`;
}

export function saveSubjectPanelState(projectId, state) {
  if (!projectId) return;
  try {
    sessionStorage.setItem(getStorageKey(projectId), JSON.stringify(state));
  } catch {
    // 会话存储不可用时不阻断主体面板打开。
  }
}

export function readSubjectPanelState(projectId) {
  if (!projectId) return null;
  try {
    const raw = sessionStorage.getItem(getStorageKey(projectId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearSubjectPanelState(projectId) {
  if (!projectId) return;
  try {
    sessionStorage.removeItem(getStorageKey(projectId));
  } catch {
    // 清理失败不影响当前面板状态。
  }
}
