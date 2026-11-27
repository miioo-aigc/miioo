/**
 * 主体生图任务的跨刷新内存/本地存储桥接。
 * 页面只通过 Map 接口读写，轮询和状态写回仍由页面负责。
 */

const STORAGE_KEY = 'miioo:pending_subject_gens';
const LEGACY_ARCHIVE_STORAGE_KEY = 'miioo:pending_subject_gens_archive';
export function createSubjectGenerationStore(getStorage) {
  const records = new Map();
  const unsaved = new Map();
  let storageError = null;
  const failure = cause => Object.assign(new Error('主体任务缓存读写异常，已暂停新生成；请保留当前页面，勿清空缓存或刷新后重试', { cause }), { code: 'SUBJECT_GENERATION_STORAGE' });
  const key = (project, owner, id) => JSON.stringify([String(project), String(owner), String(id)]);
  const writeStorage = (storageKey, raw) => {
    const storage = getStorage();
    storage.setItem(storageKey, raw);
    if (storage.getItem(storageKey) !== raw) throw new Error('缓存写入未确认');
  };
  const migrateCompletedLegacyEntries = entries => {
    const legacyDone = entries.filter(([, value]) => value.ownerId == null && value.status === 'done');
    if (!legacyDone.length) return entries;

    const storage = getStorage();
    const archiveRaw = storage.getItem(LEGACY_ARCHIVE_STORAGE_KEY);
    const archive = archiveRaw === null ? [] : JSON.parse(archiveRaw);
    if (!Array.isArray(archive)) throw new Error('历史任务备份不是列表');
    const archived = new Map();
    for (const entry of archive) {
      if (!Array.isArray(entry) || entry.length !== 2 || typeof entry[0] !== 'string'
        || !entry[1] || typeof entry[1] !== 'object' || Array.isArray(entry[1])) {
        throw new Error('历史任务备份损坏');
      }
      archived.set(entry[0], JSON.stringify(entry[1]));
    }

    const additions = [];
    for (const entry of legacyDone) {
      const [id, value] = entry;
      const serialized = JSON.stringify(value);
      if (archived.has(id)) {
        if (archived.get(id) !== serialized) throw new Error('历史任务备份冲突');
        continue;
      }
      archived.set(id, serialized);
      additions.push(entry);
    }
    if (additions.length) writeStorage(LEGACY_ARCHIVE_STORAGE_KEY, JSON.stringify([...archive, ...additions]));

    const activeEntries = entries.filter(([, value]) => value.ownerId != null || value.status !== 'done');
    writeStorage(STORAGE_KEY, JSON.stringify(activeEntries));
    return activeEntries;
  };
  const read = () => {
    const raw = getStorage().getItem(STORAGE_KEY);
    if (raw === null) return new Map();
    const entries = JSON.parse(raw);
    if (!Array.isArray(entries)) throw new Error('缓存不是列表');
    const seen = new Set();
    for (const entry of entries) {
      if (!Array.isArray(entry) || entry.length !== 2) throw new Error('缓存条目损坏');
      const [id, value] = entry;
      if (typeof id !== 'string' || seen.has(id) || !value || typeof value !== 'object' || Array.isArray(value)
        || !['pending', 'done'].includes(value.status)) throw new Error('缓存任务损坏');
      seen.add(id);
      if (value.status === 'done' && ![value.rawUrl, value.imageUrl].some(url => typeof url === 'string' && url.trim())) throw new Error('完成记录缺少图片');
      if (value.createdAt != null && (!Number.isFinite(value.createdAt) || value.createdAt <= 0)) throw new Error('任务时间损坏');
      if (value.placeholderId != null && (typeof value.placeholderId !== 'string' || !value.placeholderId)) throw new Error('任务占位损坏');
      if (['knownImageIds', 'knownImageUrls', 'refImages'].some(field => value[field] != null && !Array.isArray(value[field]))) throw new Error('任务图片记录损坏');
      if (value.ownerId != null && (!value.ownerId || value.projectId == null || value.subjectId == null
        || id !== key(value.projectId, value.ownerId, value.subjectId))) throw new Error('缓存归属损坏');
    }
    return new Map(migrateCompletedLegacyEntries(entries));
  };
  const refresh = () => {
    const disk = read();
    for (const [id, value] of disk) {
      if (JSON.stringify(records.get(id)) === JSON.stringify(value)) disk.set(id, records.get(id));
    }
    for (const [id, value] of unsaved) disk.set(id, value);
    Map.prototype.clear.call(records);
    for (const [id, value] of disk) Map.prototype.set.call(records, id, value);
    return disk;
  };
  const write = next => {
    const raw = JSON.stringify([...next]);
    writeStorage(STORAGE_KEY, raw);
    unsaved.clear();
    storageError = null;
  };
  records.set = (id, value) => {
    try {
      const next = refresh();
      next.set(id, value);
      write(next);
      Map.prototype.set.call(records, id, value);
      return records;
    } catch (cause) {
      // 已完成结果不能因为落盘失败丢失；仅当前会话可用，不承诺跨刷新。
      if (value.status === 'done') {
        unsaved.set(id, value);
        Map.prototype.set.call(records, id, value);
      }
      storageError = failure(cause);
      throw storageError;
    }
  };
  records.delete = id => {
    try {
      const next = refresh();
      const deleted = next.delete(id);
      write(next);
      Map.prototype.delete.call(records, id);
      return deleted;
    } catch (cause) {
      if (records.has(id)) unsaved.set(id, records.get(id));
      storageError = failure(cause);
      throw storageError;
    }
  };
  const assertReadable = () => {
    try { refresh(); if (!unsaved.size) storageError = null; }
    catch (cause) { storageError = failure(cause); throw storageError; }
  };
  const assertReady = (projectId, ownerId) => {
    try {
      if (projectId == null || !ownerId) throw new Error('缺少任务归属');
      const next = refresh();
      if ([...next.values()].some(value => value.ownerId == null)) throw new Error('存在归属不明的旧任务');
      write(next);
    } catch (cause) { storageError = failure(cause); throw storageError; }
  };
  try { assertReadable(); } catch { /* 由页面副作用提示，模块加载不抛错。 */ }
  return { records, assertReadable, assertReady, hasStorageError: () => !!storageError };
}

const generationStore = createSubjectGenerationStore(() => localStorage);
const pendingGenerations = generationStore.records;

export { pendingGenerations };

export function belongsToSubjectOwner(record, projectId, ownerId) {
  return projectId != null && ownerId != null && ownerId !== ''
    && record?.projectId != null && record?.ownerId != null
    && String(record.projectId) === String(projectId) && String(record.ownerId) === String(ownerId);
}

// 未标注归属的已完成记录迁移到历史区；未完成记录继续留在活动区阻止新提交。
export function getSubjectGenerationScope(projectId, ownerId, onError, store = generationStore) {
  const pendingGenerations = store.records;
  const key = id => JSON.stringify([String(projectId), String(ownerId), String(id)]);
  const entries = () => [...pendingGenerations.entries()]
    .filter(([storedKey, value]) => belongsToSubjectOwner(value, projectId, ownerId) && value.subjectId != null && storedKey === key(value.subjectId))
    .map(([, value]) => [value.subjectId, value]);
  return {
    assertReadable: store.assertReadable,
    assertReady: () => store.assertReady(projectId, ownerId),
    hasStorageError: store.hasStorageError,
    get: id => {
      const value = pendingGenerations.get(key(id));
      return belongsToSubjectOwner(value, projectId, ownerId) ? value : undefined;
    },
    set: (id, value) => {
      try { return pendingGenerations.set(key(id), { ...value, subjectId: id, projectId, ownerId }); }
      catch (error) {
        if (value.status !== 'done') throw error;
        onError?.(error);
        return false;
      }
    },
    delete: id => {
      try { return pendingGenerations.delete(key(id)); }
      catch (error) { onError?.(error); return false; }
    },
    entries,
    values: () => entries().map(([, value]) => value),
    [Symbol.iterator]: () => entries()[Symbol.iterator](),
  };
}
