// 手动意图跨面板保留；同一主体的自动保存必须先于后续手动写入结束。
const storageKey = 'miioo:subject-primary-versions';
const versions = new Map();
const writes = new Map();
try {
  const entries = JSON.parse(localStorage.getItem(storageKey) || '[]');
  if (Array.isArray(entries)) entries.forEach(([key, value]) => versions.set(key, value));
} catch { /* 存储不可用时仍保留本次运行内的保护。 */ }

const keyOf = (projectId, subjectId) => JSON.stringify([projectId, subjectId]);
export const getPrimaryVersion = (projectId, subjectId) => versions.get(keyOf(projectId, subjectId)) || 0;
export const canApplyAutomaticPrimary = (projectId, subjectId, version = 0) => (
  getPrimaryVersion(projectId, subjectId) === version
);

export function beginManualPrimary(projectId, subjectId) {
  const key = keyOf(projectId, subjectId);
  versions.set(key, getPrimaryVersion(projectId, subjectId) + 1);
  try { localStorage.setItem(storageKey, JSON.stringify([...versions])); } catch { /* 内存保护继续有效。 */ }
  return writes.get(key);
}

export function saveAutomaticPrimary(projectId, subjectId, version, save) {
  const key = keyOf(projectId, subjectId);
  const previous = writes.get(key);
  const run = async () => {
    if (previous) await previous;
    if (!canApplyAutomaticPrimary(projectId, subjectId, version)) return;
    return save();
  };
  const result = run();
  const settled = result.catch(() => {});
  writes.set(key, settled);
  void settled.then(() => { if (writes.get(key) === settled) writes.delete(key); });
  return result;
}
