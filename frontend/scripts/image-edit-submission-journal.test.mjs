import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';
import { imageEditBusinessScope } from '../src/utils/CreationEditScope.js';

const records = new Map();
let unavailable = false;
const indexedDB = { open() {
  const request = {};
  queueMicrotask(() => {
    if (unavailable) { request.onerror(); return; }
    request.result = { close() {}, transaction() {
      let aborted = false;
      const tx = { abort() { aborted = true; queueMicrotask(() => tx.onabort()); }, objectStore() {
        return {
          get(id) {
            const result = { result: structuredClone(records.get(id)) };
            queueMicrotask(() => {
              result.onsuccess();
              if (!aborted) queueMicrotask(() => tx.oncomplete());
            });
            return result;
          },
          add(value) { records.set(value.id, structuredClone(value)); },
          put(value) { records.set(value.id, structuredClone(value)); },
          delete(id) { records.delete(id); },
        };
      } };
      return tx;
    } };
    request.onsuccess();
  });
  return request;
} };
async function load() {
  const context = vm.createContext({ indexedDB });
  const module = new vm.SourceTextModule(await readFile(new URL('../src/stores/ImageEditSubmissionJournal.js', import.meta.url), 'utf8'), { context });
  await module.link((name) => name.includes('CreationEditScope') ? new vm.SyntheticModule(['imageEditBusinessScope'], function () {
    this.setExport('imageEditBusinessScope', imageEditBusinessScope);
  }, { context }) : new vm.SyntheticModule(['useCreationStore'], function () {
    this.setExport('useCreationStore', { getState: () => ({ ownerId: '甲' }) });
  }, { context }));
  await module.evaluate();
  return module.namespace;
}
const input = { owner: '甲', scope: 'subject:p:s', sourceId: 'source', mode: 'inpaint', requestId: 'request-1' };
test('刷新后阻止相同账号同源同模式；其他账号隔离；回执留存及精确清理', async () => {
  const api = await load();
  const record = await api.reserveImageEditSubmission(input);
  const reloaded = await load();
  await assert.rejects(reloaded.reserveImageEditSubmission({ ...input, scope: 'subject:owner:甲:p:s' }), /未核清/);
  await assert.rejects(reloaded.reserveImageEditSubmission({ ...input, requestId: 'request-2' }), /未核清/);
  const other = await reloaded.reserveImageEditSubmission({ ...input, owner: '乙' });
  assert.notEqual(other.id, record.id);
  await api.recordImageEditReceipt(record, { accepted: { task_id: 'task-1' } });
  assert.equal(records.get(record.id).accepted.task_id, 'task-1');
  await assert.rejects(api.finishImageEditSubmission({ ...record, requestId: 'wrong' }), /不一致/);
  assert.ok(records.has(record.id));
  await api.finishImageEditSubmission(record);
  assert.ok(records.has(other.id));
  await api.reserveImageEditSubmission(input);
});
test('损坏记录不当作空记录；存储不可用不放行', async () => {
  const api = await load();
  records.set(JSON.stringify([input.owner, input.scope, input.sourceId, input.mode]), null);
  await assert.rejects(api.reserveImageEditSubmission(input), /未核清/);
  unavailable = true;
  await assert.rejects(api.reserveImageEditSubmission(input), /尚未发送/);
  unavailable = false;
});
