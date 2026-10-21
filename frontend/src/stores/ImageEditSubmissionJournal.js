import { useCreationStore } from './creationStore';
import { imageEditBusinessScope } from '../utils/CreationEditScope';

// 独立数据库：提交前占位与去重在同一个事务中完成，避免多标签页同时发送。
function database() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('miioo-image-edit-submissions', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('submissions', { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('提交记录无法保存，尚未发送图片编辑请求'));
    request.onblocked = () => reject(new Error('提交记录被其他页面占用，尚未发送图片编辑请求'));
  });
}

async function transact(action) {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction('submissions', 'readwrite');
      let result;
      let failure;
      transaction.oncomplete = () => resolve(result);
      transaction.onerror = transaction.onabort = () => reject(failure || new Error('提交记录读写失败，请保留原任务，不要重新生成'));
      action(transaction.objectStore('submissions'), (value) => { result = value; }, (error) => { failure = error; transaction.abort(); });
    });
  } finally { db.close(); }
}

export function imageEditSubmissionOwner() {
  const owner = useCreationStore.getState().ownerId;
  if (!owner) throw new Error('尚未确认账号归属，未发送图片编辑请求');
  return String(owner);
}

export async function reserveImageEditSubmission({ owner, scope, sourceId, mode, requestId }) {
  // 非创作日志已独立带账号，保留旧业务键以延续此前受理不明保护。
  if (scope?.startsWith('subject:') || scope?.startsWith('storyboard:')) scope = imageEditBusinessScope(scope);
  if (!owner || !scope || !sourceId || !mode || !requestId) throw new Error('提交记录缺少必要信息，未发送图片编辑请求');
  const record = { id: JSON.stringify([owner, scope, sourceId, mode]), owner, scope, sourceId, mode, requestId,
    createdAt: new Date().toISOString(), status: 'uncertain' };
  return transact((store, done, fail) => {
    const request = store.get(record.id);
    request.onsuccess = () => {
      if (request.result !== undefined) {
        fail(new Error('这张图片的同类编辑已有未核清的提交记录，请核查任务或资产库；为避免重复生成，本次未发送'));
        return;
      }
      store.add(record);
      done(record);
    };
  });
}

export function recordImageEditReceipt(record, { accepted, image }) {
  return transact((store, done, fail) => {
    const request = store.get(record.id);
    request.onsuccess = () => {
      if (request.result?.requestId !== record.requestId) {
        fail(new Error('提交记录不一致，请保留原任务并核查'));
        return;
      }
      store.put({ ...request.result, status: 'accepted', accepted, image });
      done();
    };
  });
}

export function finishImageEditSubmission(record) {
  return transact((store, done, fail) => {
    const request = store.get(record.id);
    request.onsuccess = () => {
      if (request.result?.requestId !== record.requestId) {
        fail(new Error('提交记录不一致，未清除保护记录'));
        return;
      }
      store.delete(record.id);
      done();
    };
  });
}
