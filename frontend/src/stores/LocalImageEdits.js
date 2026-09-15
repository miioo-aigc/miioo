import { create } from 'zustand';
import { apiResolveImageEdit, normalizeEditedImage } from '../api/ImageEdit';
import { showGlobalToast } from './toastStore';

const EMPTY = [];
let database;
const loads = new Map();
const resumptions = new Map();

function openDatabase() {
  if (!database) database = new Promise((resolve, reject) => {
    const request = indexedDB.open('miioo-local-image-edits', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('images', { keyPath: 'id' }).createIndex('scope', 'scope');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { database = null; reject(request.error); };
  });
  return database;
}

async function transact(mode, action) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('images', mode);
    const request = action(transaction.objectStore('images'));
    transaction.oncomplete = () => resolve(request.result);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error || new Error('本地图片保存失败'));
  });
}

function materialize(record) {
  const url = record.remoteUrl || URL.createObjectURL(record.blob);
  return { ...record, url, fileUrl: url, src: url, imageUrl: url, rawUrl: url, previewUrl: url, status: 'done', media_type: 'image', type: 'image', localEdit: true, settled: false, is_primary: false, is_finalized: false, detailSource: 'frontend-edit' };
}

export const useLocalImageEditStore = create(() => ({ byScope: {} }));
export const localImagesFor = (state, scope) => state.byScope[scope] || EMPTY;

export async function loadLocalImages(scope) {
  if (!scope) return;
  if (!loads.has(scope)) loads.set(scope, transact('readonly', (store) => store.index('scope').getAll(scope)).then((records) => {
    useLocalImageEditStore.setState((state) => ({ byScope: { ...state.byScope, [scope]: records.filter((record) => !record.pending).sort((a, b) => a.created_at.localeCompare(b.created_at)).map(materialize) } }));
    records.filter((record) => record.pending).forEach((record) => {
      resumePendingImage(record).catch((error) => showGlobalToast(error.message || '图片编辑任务恢复失败', 'error'));
    });
  }).catch((error) => { loads.delete(scope); throw error; }));
  await loads.get(scope);
}

export async function saveLocalImage(scope, image) {
  if (!scope || (!(image.blob instanceof Blob) && !image.remoteUrl)) throw new Error('缺少图片或列表归属');
  await loadLocalImages(scope);
  // 只持久化实体和必要元数据，不保存刷新后失效的临时地址。
  const record = { id: image.pendingRecordId || `local-edit-${crypto.randomUUID()}`, scope, blob: image.blob, remoteUrl: image.remoteUrl, originalUrl: image.originalUrl, creationAssetId: image.creationAssetId, backendId: image.backendId, model: image.model, prompt: image.prompt, ratio: image.ratio, resolution: image.resolution, width: image.width, height: image.height, source: image.source, created_at: new Date().toISOString() };
  await transact('readwrite', (store) => store.put(record));
  const result = materialize(record);
  useLocalImageEditStore.setState((state) => ({ byScope: { ...state.byScope, [scope]: [...localImagesFor(state, scope).filter((item) => item.id !== result.id), result] } }));
  return result;
}

function resumePendingImage(record) {
  if (!resumptions.has(record.id)) resumptions.set(record.id, (async () => {
    try {
      const result = normalizeEditedImage(await apiResolveImageEdit(record.accepted, record.mode));
      return await saveLocalImage(record.scope, { ...result, pendingRecordId: record.id });
    } catch (error) {
      if (error.terminal) await transact('readwrite', (store) => store.delete(record.id));
      throw error;
    } finally { resumptions.delete(record.id); }
  })());
  return resumptions.get(record.id);
}

export async function savePendingImage(scope, pending) {
  await loadLocalImages(scope);
  const taskId = pending.accepted.task_id || pending.accepted.taskId || pending.accepted.id;
  const record = { id: `pending-edit:${scope}:${taskId}`, scope, pending: true, ...pending, created_at: new Date().toISOString() };
  await transact('readwrite', (store) => store.put(record));
  return resumePendingImage(record);
}

export async function removeLocalImage(scope, id) {
  await loadLocalImages(scope);
  const image = localImagesFor(useLocalImageEditStore.getState(), scope).find((item) => item.id === id);
  if (!image) return;
  await transact('readwrite', (store) => store.delete(id));
  useLocalImageEditStore.setState((state) => ({ byScope: { ...state.byScope, [scope]: localImagesFor(state, scope).filter((item) => item.id !== id) } }));
  URL.revokeObjectURL(image.url);
}

export function downloadLocalImage(image) {
  const anchor = document.createElement('a');
  anchor.href = image.fileUrl || image.url;
  anchor.download = `${image.id}.png`;
  anchor.click();
}
