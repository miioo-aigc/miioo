/**
 * 剧本输入暂存缓存 —— 基于 IndexedDB，按项目隔离，每项目上限 10 条。
 *
 * 用法：
 *   import { saveDraft, getDraft, getCacheCount } from '../utils/scriptDraftCache';
 *   saveDraft(projectId, { text, modelId, episodeCount, episodeDuration });
 *   const draft = await getDraft(projectId, 0);
 *   const count = await getCacheCount(projectId);
 */

const DB_NAME = 'miioo_script_drafts';
const DB_VERSION = 1;
const STORE_NAME = 'drafts';
const MAX_PER_PROJECT = 10;

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('project_timestamp', ['projectId', 'timestamp'], { unique: false });
      }
    };

    request.onsuccess = (event) => {
      const db = event.target.result;
      resolve(db);
    };

    request.onerror = () => reject(request.error);
  });

  return dbPromise;
}

/**
 * 保存草稿。fire-and-forget，不阻塞调用方。
 * @param {string} projectId
 * @param {{ text: string, modelId: string|null, episodeCount: number|null, episodeDuration: number|null }} draft
 */
export async function saveDraft(projectId, { text, modelId, episodeCount, episodeDuration }) {
  try {
    const db = await openDB();

    const entry = {
      id: `${projectId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      projectId,
      timestamp: Date.now(),
      text: text || '',
      modelId: modelId || null,
      episodeCount: episodeCount != null ? episodeCount : null,
      episodeDuration: episodeDuration != null ? episodeDuration : 60,
    };

    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.add(entry);

    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });

    // 裁剪超过上限的最旧条目
    await trimProject(projectId);
  } catch (err) {
    console.warn('[scriptDraftCache] 保存草稿失败:', err?.message);
  }
}

async function trimProject(projectId) {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('project_timestamp');

    const all = await new Promise((resolve, reject) => {
      const results = [];
      const cursorReq = index.openCursor(IDBKeyRange.bound([projectId, 0], [projectId, Infinity]), 'prev');
      cursorReq.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          results.push(cursor.value);
          cursor.continue();
        } else {
          resolve(results);
        }
      };
      cursorReq.onerror = () => reject(cursorReq.error);
    });

    // 超过上限则删除最旧（timestamp 最小的排在数组末尾）
    if (all.length > MAX_PER_PROJECT) {
      const toDelete = all.slice(MAX_PER_PROJECT);
      for (const entry of toDelete) {
        store.delete(entry.id);
      }
    }

    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('[scriptDraftCache] 裁剪缓存失败:', err?.message);
  }
}

/**
 * 获取某个项目的第 index 条草稿（0 = 最新）。
 * @param {string} projectId
 * @param {number} index
 * @returns {Promise<{ text: string, modelId: string|null, episodeCount: number|null, episodeDuration: number|null }|null>}
 */
export async function getDraft(projectId, index) {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const idx = store.index('project_timestamp');

    const all = await new Promise((resolve, reject) => {
      const results = [];
      const cursorReq = idx.openCursor(IDBKeyRange.bound([projectId, 0], [projectId, Infinity]), 'prev');
      cursorReq.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          results.push(cursor.value);
          cursor.continue();
        } else {
          resolve(results);
        }
      };
      cursorReq.onerror = () => reject(cursorReq.error);
    });

    if (index >= all.length) return null;

    const entry = all[index];

    return {
      text: entry.text,
      modelId: entry.modelId,
      episodeCount: entry.episodeCount,
      episodeDuration: entry.episodeDuration ?? 60,
    };
  } catch (err) {
    console.warn('[scriptDraftCache] 读取草稿失败:', err?.message);
    return null;
  }
}

/**
 * 获取某项目的缓存条数。
 * @param {string} projectId
 * @returns {Promise<number>}
 */
export async function getCacheCount(projectId) {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const idx = store.index('project_timestamp');

    const count = await new Promise((resolve, reject) => {
      const countReq = idx.count(IDBKeyRange.bound([projectId, 0], [projectId, Infinity]));
      countReq.onsuccess = () => resolve(countReq.result);
      countReq.onerror = () => reject(countReq.error);
    });

    return count;
  } catch (err) {
    console.warn('[scriptDraftCache] 读取缓存数失败:', err?.message);
    return 0;
  }
}

/**
 * 清除某项目的所有草稿。
 * @param {string} projectId
 */
export async function clearProjectDrafts(projectId) {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const idx = store.index('project_timestamp');

    const ids = await new Promise((resolve, reject) => {
      const results = [];
      const cursorReq = idx.openCursor(IDBKeyRange.bound([projectId, 0], [projectId, Infinity]));
      cursorReq.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          results.push(cursor.value.id);
          cursor.continue();
        } else {
          resolve(results);
        }
      };
      cursorReq.onerror = () => reject(cursorReq.error);
    });

    for (const id of ids) {
      store.delete(id);
    }

    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('[scriptDraftCache] 清除缓存失败:', err?.message);
  }
}
