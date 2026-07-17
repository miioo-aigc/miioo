/**
 * 主体生图任务的跨刷新内存/本地存储桥接。
 * 页面只通过 Map 接口读写，轮询和状态写回仍由页面负责。
 */

const STORAGE_KEY = 'miioo:pending_subject_gens';
const pendingGenerations = new Map();

function savePendingGenerations() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(pendingGenerations.entries())));
  } catch {
    // 本地存储不可用时仍继续当前生成流程。
  }
}

function restorePendingGenerations() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const entries = JSON.parse(raw);
    if (!Array.isArray(entries)) return;
    for (const [key, value] of entries) {
      if (!pendingGenerations.has(key)) pendingGenerations.set(key, value);
    }
  } catch {
    // 历史挂起任务损坏时忽略该条记录，页面仍可继续使用。
  }
}

const originalSet = pendingGenerations.set.bind(pendingGenerations);
const originalDelete = pendingGenerations.delete.bind(pendingGenerations);
pendingGenerations.set = (key, value) => {
  const result = originalSet(key, value);
  savePendingGenerations();
  return result;
};
pendingGenerations.delete = (key) => {
  const result = originalDelete(key);
  savePendingGenerations();
  return result;
};

restorePendingGenerations();

export { pendingGenerations };
