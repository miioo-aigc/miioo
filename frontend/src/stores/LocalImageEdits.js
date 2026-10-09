import { create } from 'zustand';
import { apiResolveImageEdit, normalizeEditedImage } from '../api/ImageEdit';
import { showGlobalToast } from './toastStore';
import { downloadUrlWithFeedback } from '../utils/downloadFeedback';
import { bindImageEditResult } from '../api/ImageEditSave';
import { syncCreationImageEdit, removeCreationImageEdit } from './CreationImageEdits';

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
  if (record.pending) return { ...record, status: 'loading', uploading: true, media_type: 'image', type: 'image', localEdit: true };
  const url = record.remoteUrl || URL.createObjectURL(record.blob);
  return { ...record, url, fileUrl: url, src: url, imageUrl: url, rawUrl: url, previewUrl: url, status: 'done', media_type: 'image', type: 'image', localEdit: true, settled: false, is_primary: false, is_finalized: false, detailSource: 'frontend-edit' };
}

export const useLocalImageEditStore = create(() => ({ byScope: {} }));
export const localImagesFor = (state, scope) => state.byScope[scope] || EMPTY;

function publish(record) {
  const result = materialize(record);
  useLocalImageEditStore.setState((state) => {
    const items = localImagesFor(state, record.scope);
    return { byScope: { ...state.byScope, [record.scope]: items.some((item) => item.id === record.id)
      ? items.map((item) => item.id === record.id ? result : item) : [...items, result] } };
  });
  syncCreationImageEdit(result);
  return result;
}

async function discard(record) {
  removeCreationImageEdit(record);
  useLocalImageEditStore.setState((state) => ({ byScope: { ...state.byScope,
    [record.scope]: localImagesFor(state, record.scope).filter((item) => item.id !== record.id) } }));
  await transact('readwrite', (store) => store.delete(record.id));
}

export async function loadLocalImages(scope) {
  if (!scope) return;
  if (!loads.has(scope)) loads.set(scope, transact('readonly', (store) => store.index('scope').getAll(scope)).then((records) => {
    useLocalImageEditStore.setState((state) => ({ byScope: { ...state.byScope, [scope]: records.filter((record) => !record.abandoned).sort((a, b) => a.created_at.localeCompare(b.created_at)).map(materialize) } }));
    localImagesFor(useLocalImageEditStore.getState(), scope).forEach(syncCreationImageEdit);
    records.filter((record) => record.pending && !record.abandoned).forEach((record) => {
      resumePendingImage(record).catch((error) => showGlobalToast(error.message || '图片编辑任务恢复失败', 'error'));
    });
  }).catch((error) => { loads.delete(scope); throw error; }));
  await loads.get(scope);
}

export async function saveLocalImage(scope, image) {
  if (!scope || (!(image.blob instanceof Blob) && !image.remoteUrl)) throw new Error('缺少图片或列表归属');
  await loadLocalImages(scope);
  // 只持久化实体和必要元数据，不保存刷新后失效的临时地址。
  const record = { id: image.pendingRecordId || `local-edit-${crypto.randomUUID()}`, scope, blob: image.blob, remoteUrl: image.remoteUrl, originalUrl: image.originalUrl, creationAssetId: image.creationAssetId, backendId: image.backendId, model: image.model, prompt: image.prompt, ratio: image.ratio, resolution: image.resolution, width: image.width, height: image.height, source: image.source, metadata_json: image.metadata_json, edit_type: image.edit_type, edit_mode: image.edit_mode, source_asset_id: image.source_asset_id, created_at: new Date().toISOString() };
  await transact('readwrite', (store) => store.put(record));
  return publish(record);
}

function resumePendingImage(record) {
  if (!resumptions.has(record.id)) resumptions.set(record.id, (async () => {
    try {
      if (!record.image) await transact('readwrite', (store) => store.put(record));
      const image = record.image || await apiResolveImageEdit(record.accepted, record.mode);
      record.image = image;
      // 重试只处理同一张已生成图片，不重新提交生成；次数随任务持久化。
      while ((record.saveAttempts || 0) < 5) {
        record.saveAttempts = (record.saveAttempts || 0) + 1;
        try {
          await transact('readwrite', (store) => store.put(record));
          const edited = record.destination ? { ...image, edit_type: 'image_edit', edit_mode: record.mode, source_asset_id: record.sourceId } : image;
          record.boundResult ||= record.destination ? await bindImageEditResult(edited, record.destination) : normalizeEditedImage(edited);
          await transact('readwrite', (store) => store.put(record));
          return await saveLocalImage(record.scope, { ...record.boundResult, pendingRecordId: record.id });
        } catch {
          if (record.saveAttempts < 5) await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }
      throw new Error('图片已生成，但自动保存 5 次均失败，已放弃本次任务，请重新发起生成');
    } catch (error) {
      error.terminal = true;
      record.abandoned = true;
      await discard(record).catch(async () => {
        await transact('readwrite', (store) => store.put(record)).catch(() => {});
      });
      throw error;
    } finally { resumptions.delete(record.id); }
  })());
  return resumptions.get(record.id);
}

export async function savePendingImage(scope, pending) {
  await loadLocalImages(scope);
  const taskId = pending.accepted?.task_id || pending.accepted?.taskId || pending.accepted?.id || pending.image?.asset_id || pending.image?.id;
  if (!taskId) throw new Error('保存编辑任务失败：缺少任务或资产编号');
  const id = `pending-edit:${scope}:${taskId}`;
  const existing = await transact('readonly', (store) => store.get(id));
  if (existing && !existing.pending) return materialize(existing);
  const record = existing || { id, scope, pending: true, ...pending, created_at: new Date().toISOString() };
  publish(record);
  return resumePendingImage(record);
}

export async function removeLocalImage(scope, id) {
  await loadLocalImages(scope);
  const image = localImagesFor(useLocalImageEditStore.getState(), scope).find((item) => item.id === id);
  if (!image) return;
  await transact('readwrite', (store) => store.delete(id));
  removeCreationImageEdit(image);
  useLocalImageEditStore.setState((state) => ({ byScope: { ...state.byScope, [scope]: localImagesFor(state, scope).filter((item) => item.id !== id) } }));
  URL.revokeObjectURL(image.url);
}

export async function downloadLocalImage(image) {
  const filename = `${image.id}.png`;
  await downloadUrlWithFeedback(image.fileUrl || image.url, filename, {
    message: '正在下载',
    fallbackToAnchor: true,
  });
}
