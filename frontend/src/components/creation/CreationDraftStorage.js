/**
 * 创作草稿临时存储。
 *
 * IndexedDB 支持结构化克隆，可临时保存本地上传的 File/Blob、资产引用和参数，
 * 避免把大文件或 Blob URL 写入 sessionStorage/localStorage。
 */

const DATABASE_NAME = 'miioo-creation-drafts';
const STORE_NAME = 'drafts';
const DATABASE_VERSION = 1;
const SUPPORTED_TYPES = new Set(['image', 'video', 'dubbing']);
const MEMORY_STORE_KEY = '__miiooCreationDrafts__';
const PROMPT_STORAGE_PREFIX = 'miioo:creation_draft_prompt:';
const memoryDrafts = globalThis[MEMORY_STORE_KEY] ?? new Map();

if (!globalThis[MEMORY_STORE_KEY]) {
  globalThis[MEMORY_STORE_KEY] = memoryDrafts;
}

function savePromptFallback(type, prompt) {
  try {
    sessionStorage.setItem(`${PROMPT_STORAGE_PREFIX}${type}`, String(prompt ?? ''));
  } catch {
    // sessionStorage 仅作提示词兜底，写入失败不影响完整草稿缓存。
  }
}

function readPromptFallback(type) {
  try {
    return sessionStorage.getItem(`${PROMPT_STORAGE_PREFIX}${type}`) ?? '';
  } catch {
    return '';
  }
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function runTransaction(mode, type, value) {
  if (!SUPPORTED_TYPES.has(type) || typeof indexedDB === 'undefined') return null;
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, mode);
      const store = transaction.objectStore(STORE_NAME);
      const request = mode === 'readonly' ? store.get(type) : store.put(value, type);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
    });
  } finally {
    database.close();
  }
}

export async function saveCreationDraft(type, draft) {
  if (!SUPPORTED_TYPES.has(type)) return;
  const nextDraft = {
    ...draft,
    updatedAt: Date.now(),
  };
  memoryDrafts.set(type, nextDraft);
  savePromptFallback(type, nextDraft.prompt);
  try {
    await runTransaction('readwrite', type, nextDraft);
  } catch {
    // 浏览器不支持或存储空间不足时，不阻断当前创作流程。
  }
}

export function readCreationDraftFromMemory(type) {
  if (!SUPPORTED_TYPES.has(type)) return null;
  return memoryDrafts.get(type) ?? null;
}

export async function readCreationDraft(type) {
  if (!SUPPORTED_TYPES.has(type)) return null;

  // 提示词兜底只用于 IndexedDB 没有完整草稿的情况，不能提前返回并遮蔽其中的 File/Blob。
  const memoryDraft = memoryDrafts.get(type);
  if (memoryDraft) return memoryDraft;

  try {
    const storedDraft = await runTransaction('readonly', type);
    // IndexedDB 读取期间用户可能已写入了更新的草稿，优先保留内存中的新版本。
    const latestDraft = memoryDrafts.get(type);
    if (latestDraft) return latestDraft;
    if (storedDraft) {
      memoryDrafts.set(type, storedDraft);
      savePromptFallback(type, storedDraft.prompt);
      return storedDraft;
    }

    const prompt = readPromptFallback(type);
    return prompt ? { prompt } : null;
  } catch {
    // IndexedDB 不可用时仍保留提示词兜底，但不伪造素材草稿。
    const prompt = readPromptFallback(type);
    return prompt ? { prompt } : null;
  }
}
