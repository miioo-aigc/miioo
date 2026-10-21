import { create } from 'zustand';
import { apiResolveImageEdit, normalizeEditedImage } from '../api/ImageEdit';
import { showGlobalToast } from './toastStore';
import { downloadUrlWithFeedback } from '../utils/downloadFeedback';
import { bindImageEditResult } from '../api/ImageEditSave';
import { syncCreationImageEdit, removeCreationImageEdit } from './CreationImageEdits';
import { imageEditOwner } from '../utils/CreationEditScope';
import { useCreationStore } from './creationStore';
import { getAuthSessionGeneration } from '../api/request';
import { imageEditSessionCheck } from '../api/ImageEditSession';
import { createImageEditRemovalChannel } from '../utils/ImageEditRemovalChannel';

const EMPTY = [];
let database;
const loads = new Map();
const resumptions = new Map();
const removed = new Set();
let removalChannel;

function applyRemoval(scope, id) {
  removed.add(id);
  loads.delete(scope);
  const image = useLocalImageEditStore.getState().byScope[scope]?.find((item) => item.id === id);
  removeCreationImageEdit({ id, scope });
  useLocalImageEditStore.setState((state) => ({ byScope: { ...state.byScope,
    [scope]: (state.byScope[scope] || EMPTY).filter((item) => item.id !== id) } }));
  if (image?.url?.startsWith('blob:')) URL.revokeObjectURL(image.url);
}

export async function verifyImageEditRemoval(scope, id) {
  if (!ownsScope(scope)) return;
  const session = getAuthSessionGeneration();
  const record = await transact('readonly', (store) => store.get(id));
  if (!ownsScope(scope) || session !== getAuthSessionGeneration()) return;
  if (record?.removed && record.scope === scope) applyRemoval(scope, id);
}

export async function reconcileImageEditRemovals() {
  // 只核验本页面已缓存的本地卡片，不扫描整个项目或全部删除历史。
  for (const [scope, images] of Object.entries(useLocalImageEditStore.getState().byScope)) {
    if (!ownsScope(scope)) continue;
    for (const image of images) await verifyImageEditRemoval(scope, image.id);
  }
}

function ensureRemovalChannel() {
  removalChannel ||= createImageEditRemovalChannel({
    verify: verifyImageEditRemoval, reconcile: reconcileImageEditRemovals,
    onError: () => showGlobalToast('本地移除状态同步失败，请重新进入列表核查', 'error'),
  });
}

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
  if (record.pending) return { ...record, status: record.retryPaused ? 'paused' : 'loading', uploading: !record.retryPaused, media_type: 'image', type: 'image', localEdit: true };
  const url = record.remoteUrl || URL.createObjectURL(record.blob);
  return { ...record, url, fileUrl: url, src: url, imageUrl: url, rawUrl: url, previewUrl: url, status: 'done', media_type: 'image', type: 'image', localEdit: true, settled: false, is_primary: false, is_finalized: false, detailSource: 'frontend-edit' };
}

function removedError() {
  return Object.assign(new Error('该记录已从本地移除，未取消后端任务'), { name: 'AbortError', locallyRemoved: true });
}

async function writeRecord(record) {
  // 读取标记和写回放在同一个事务，迟到结果不能覆盖其他页面写入的删除标记。
  const saved = await transact('readwrite', (store) => {
    const result = { result: false };
    const request = store.get(record.id);
    request.onsuccess = () => {
      if (request.result?.removed || removed.has(record.id)) return;
      store.put(record);
      result.result = true;
    };
    return result;
  });
  if (!saved) { applyRemoval(record.scope, record.id); throw removedError(); }
}

export const useLocalImageEditStore = create(() => ({ byScope: {} }));
const ownsScope = (scope) => Boolean(imageEditOwner(scope)) && imageEditOwner(scope) === String(useCreationStore.getState().ownerId ?? '');
export const localImagesFor = (state, scope) => ownsScope(scope) ? state.byScope[scope] || EMPTY : EMPTY;

function publish(record) {
  if (removed.has(record.id) || record.removed) return;
  const result = materialize(record);
  if (!ownsScope(record.scope)) { loads.delete(record.scope); return result; }
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
  await writeRecord(record);
}

export async function loadLocalImages(scope, { retryPaused = false } = {}) {
  ensureRemovalChannel();
  if (!scope) return;
  if (!ownsScope(scope)) return;
  const session = getAuthSessionGeneration();
  if (!loads.has(scope)) loads.set(scope, transact('readonly', (store) => store.index('scope').getAll(scope)).then((records) => {
    if (!ownsScope(scope) || session !== getAuthSessionGeneration()) { loads.delete(scope); return; }
    records.filter((record) => record.removed).forEach((record) => removed.add(record.id));
    useLocalImageEditStore.setState((state) => ({ byScope: { ...state.byScope, [scope]: records.filter((record) => !record.abandoned && !record.removed && !removed.has(record.id)).sort((a, b) => a.created_at.localeCompare(b.created_at)).map(materialize) } }));
    localImagesFor(useLocalImageEditStore.getState(), scope).forEach(syncCreationImageEdit);
  }).catch((error) => { loads.delete(scope); throw error; }));
  await loads.get(scope);
  if (!ownsScope(scope) || session !== getAuthSessionGeneration()) return;
  localImagesFor(useLocalImageEditStore.getState(), scope).forEach(syncCreationImageEdit);
  localImagesFor(useLocalImageEditStore.getState(), scope).filter((record) => record.pending && !record.abandoned && (retryPaused || !record.retryPaused)).forEach((record) => {
    resumePendingImage(record).catch((error) => { if (error.name !== 'AbortError') showGlobalToast(error.message || '图片编辑任务恢复失败', 'error'); });
  });
}

export async function saveLocalImage(scope, image) {
  if (!scope || (!(image.blob instanceof Blob) && !image.remoteUrl)) throw new Error('缺少图片或列表归属');
  if (!ownsScope(scope)) throw new Error('图片编辑账号归属不符，未自动认领旧记录');
  const checkSession = imageEditSessionCheck();
  await loadLocalImages(scope);
  checkSession();
  // 只持久化实体和必要元数据，不保存刷新后失效的临时地址。
  const record = { id: image.pendingRecordId || `local-edit-${crypto.randomUUID()}`, scope, blob: image.blob, remoteUrl: image.remoteUrl, originalUrl: image.originalUrl, creationAssetId: image.creationAssetId, backendId: image.backendId, model: image.model, prompt: image.prompt, ratio: image.ratio, resolution: image.resolution, width: image.width, height: image.height, source: image.source, metadata_json: image.metadata_json, edit_type: image.edit_type, edit_mode: image.edit_mode, source_asset_id: image.source_asset_id, created_at: new Date().toISOString() };
  await writeRecord(record);
  return publish(record);
}

function resumePendingImage(record) {
  if (!resumptions.has(record.id)) resumptions.set(record.id, (async () => {
    const session = getAuthSessionGeneration();
    const checkAccount = imageEditSessionCheck();
    const checkSession = () => { checkAccount(); if (removed.has(record.id)) throw removedError(); };
    const isCurrent = () => session === getAuthSessionGeneration() && ownsScope(record.scope) && !removed.has(record.id);
    try {
      await writeRecord(record);
      if (!isCurrent()) return;
      record.retryPaused = false;
      record.error = '';
      const image = record.image || await apiResolveImageEdit(record.accepted, record.mode, { checkSession });
      record.image = image;
      await writeRecord(record);
      publish(record);
      // 重试只处理同一张已生成图片，不重新提交生成；次数随任务持久化。
      for (let attempt = 0; attempt < 5; attempt++) {
        if (!isCurrent()) return;
        record.saveAttempts = (record.saveAttempts || 0) + 1;
        try {
          await writeRecord(record);
          if (!isCurrent()) return;
          const edited = record.destination ? { ...image, edit_type: image.edit_type || 'image_edit', edit_mode: image.edit_mode || record.mode, source_asset_id: image.source_asset_id || record.sourceId } : image;
          record.boundResult ||= record.destination ? await bindImageEditResult(edited, record.destination) : normalizeEditedImage(edited);
          await writeRecord(record);
          if (!isCurrent()) { publish(record); return; }
          return await saveLocalImage(record.scope, { ...record.boundResult, pendingRecordId: record.id });
        } catch {
          if (!isCurrent()) return;
          if (attempt < 4) await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }
      throw new Error('图片已生成，本轮自动保存 5 次未成功，原结果已保留，请继续保存原任务，不要重复生成');
    } catch (error) {
      if (!isCurrent()) return;
      if (error.terminal) {
        record.abandoned = true;
        await discard(record).catch(async () => {
          await writeRecord(record);
        });
      } else {
        record.retryPaused = true;
        record.error = error.message || '读取或保存失败，原任务已保留';
        await writeRecord(record);
        publish(record);
      }
      throw error;
    } finally { resumptions.delete(record.id); }
  })());
  return resumptions.get(record.id);
}

export async function savePendingImage(scope, pending) {
  if (!imageEditOwner(scope)) {
    throw new Error('图片编辑缺少账号归属，未自动认领旧记录');
  }
  const session = getAuthSessionGeneration();
  await loadLocalImages(scope);
  const taskId = pending.accepted?.task_id || pending.accepted?.taskId || pending.accepted?.id || pending.image?.asset_id || pending.image?.id;
  if (!taskId) throw new Error('保存编辑任务失败：缺少任务或资产编号');
  const id = `pending-edit:${scope}:${taskId}`;
  const existing = await transact('readonly', (store) => store.get(id));
  if (existing?.removed || existing?.abandoned || removed.has(id)) throw removedError();
  if (existing && !existing.pending) return materialize(existing);
  const record = existing || { id, scope, pending: true, ...pending, created_at: new Date().toISOString() };
  record.retryPaused = false;
  record.error = '';
  await writeRecord(record);
  publish(record);
  if (!ownsScope(scope) || session !== getAuthSessionGeneration()) return;
  return resumePendingImage(record);
}

export async function removeLocalImage(scope, id) {
  ensureRemovalChannel();
  if (!ownsScope(scope)) return;
  const checkSession = imageEditSessionCheck();
  const image = await transact('readonly', (store) => store.get(id));
  checkSession();
  if (!image || image.scope !== scope) return;
  await transact('readwrite', (store) => store.put({ id, scope, removed: true, removedAt: new Date().toISOString() }));
  applyRemoval(scope, id);
  removalChannel.notify(scope, id);
}

export async function downloadLocalImage(image) {
  const filename = `${image.id}.png`;
  await downloadUrlWithFeedback(image.fileUrl || image.url, filename, {
    message: '正在下载',
    fallbackToAnchor: true,
  });
}
