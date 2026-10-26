import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
const source = readFileSync(new URL('../src/hooks/useProfileAutosave.js', import.meta.url), 'utf8').replace(/^import .*;$/gm, '').replace('export function', 'function');
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const tick = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
function harness() {
  let cursor = 0, generation = 1, nextUrl = 0;
  const slots = [], effects = [], updates = [], writes = [], uploads = [], revoked = [], toasts = [];
  const useRef = value => { const i = cursor++; return slots[i] ??= { current: value }; };
  const useState = value => { const i = cursor++; if (!(i in slots)) slots[i] = value; return [slots[i], next => { slots[i] = next; }]; };
  const useCallback = fn => { const i = cursor++; return slots[i] ??= fn; };
  const useEffect = (fn, deps) => { const i = cursor++; const old = effects[i]; if (!old || deps.some((d, k) => old.deps[k] !== d)) { old?.cleanup?.(); effects[i] = { deps, cleanup: fn() }; } };
  const user = { id: 'u', nickname: '原昵称', avatar_url: '/old.png' };
  const onUpdated = value => updates.push(value);
  const hook = new Function('useRef','useState','useCallback','useEffect','apiUpdateProfile','apiUploadAvatar','getAuthSessionGeneration','showGlobalToast','URL',source + '\nreturn useProfileAutosave;')(
    useRef,useState,useCallback,useEffect,
    payload => { const d = deferred(); writes.push({ payload, ...d }); return d.promise; },
    file => { const d = deferred(); uploads.push({ file, ...d }); return d.promise; },
    () => generation, (...args) => toasts.push(args),
    { createObjectURL: () => 'blob:' + ++nextUrl, revokeObjectURL: value => revoked.push(value) }
  );
  return { render() { cursor = 0; return hook(user, onUpdated); }, unmount() { effects.forEach(e => e?.cleanup?.()); }, switchAccount() { generation++; }, updates, writes, uploads, revoked, toasts };
}
test('头像上传期间修改昵称，分别只提交自己的字段', async () => {
  const h = harness(), op = h.render();
  const avatar = op.uploadAvatar({}); op.editName('新昵称'); const name = op.saveName('新昵称'); await tick();
  assert.deepEqual(h.writes[0].payload, { nickname: '新昵称' });
  h.uploads[0].resolve({ avatarUrl: '/new.png' }); await tick(); assert.equal(h.writes.length, 1);
  h.writes[0].resolve({ nickname: '新昵称', avatar_url: '/old.png' }); await name; await tick();
  assert.deepEqual(h.writes[1].payload, { avatar_url: '/new.png' });
  h.writes[1].resolve({ nickname: '旧快照', avatar_url: '/new.png' }); await avatar;
  assert.deepEqual(h.updates, [{ nickname: '新昵称' }, { avatar_url: '/new.png' }]);
  assert.equal(h.render().name, '新昵称'); assert.equal(h.render().avatar, '/new.png'); assert.deepEqual(h.revoked, ['blob:1']);
});
test('新昵称草稿不被旧保存回执覆盖，后续失焦按序保存', async () => {
  const h = harness(), op = h.render(); op.editName('甲'); const a = op.saveName('甲'); await tick();
  op.editName('乙'); const b = op.saveName('乙');
  h.writes[0].resolve({ nickname: '甲' }); await a; await tick();
  assert.equal(h.render().name, '乙'); assert.equal(h.updates.length, 0);
  h.writes[1].resolve({ nickname: '乙' }); await b; assert.deepEqual(h.updates, [{ nickname: '乙' }]);
});
test('昵称改回旧值也需等待前一保存，不能被先前写入覆盖', async () => {
  const h = harness(), op = h.render(); op.editName('甲'); const a = op.saveName('甲'); await tick();
  op.editName('原昵称'); const b = op.saveName('原昵称');
  h.writes[0].resolve({ nickname: '甲' }); await a; await tick();
  assert.deepEqual(h.writes[1].payload, { nickname: '原昵称' });
  h.writes[1].resolve({ nickname: '原昵称' }); await b;
});
test('上传乱序只保存最新头像，释放每个本地预览', async () => {
  const h = harness(), op = h.render(); const a = op.uploadAvatar({}); const b = op.uploadAvatar({});
  h.uploads[1].resolve({ avatarUrl: '/b.png' }); await tick();
  h.writes[0].resolve({ avatar_url: '/b.png' }); await b;
  h.uploads[0].resolve({ avatarUrl: '/a.png' }); await a;
  assert.equal(h.writes.length, 1); assert.equal(h.render().avatar, '/b.png'); assert.deepEqual(h.revoked, ['blob:1', 'blob:2']);
});
for (const stage of ['上传', '保存']) test(stage + '失败恢复头像并允许重新选择', async () => {
  const h = harness(), op = h.render(); const p = op.uploadAvatar({});
  if (stage === '上传') h.uploads[0].reject(new Error('失败'));
  else { h.uploads[0].resolve({ avatarUrl: '/new.png' }); await tick(); h.writes[0].reject(new Error('失败')); }
  await p; assert.equal(h.render().avatar, '/old.png'); assert.equal(h.toasts.length, 1); assert.deepEqual(h.revoked, ['blob:1']);
  const retry = op.uploadAvatar({}); h.uploads[1].reject(new Error('失败')); await retry; assert.equal(h.uploads.length, 2);
});
test('昵称失败保留草稿且可再次失焦重试', async () => {
  const h = harness(), op = h.render(); op.editName('新昵称'); const p = op.saveName('新昵称'); await tick();
  h.writes[0].reject(new Error('失败')); await p; assert.equal(h.render().name, '新昵称');
  const retry = op.saveName('新昵称'); await tick(); h.writes[1].resolve({ nickname: '新昵称' }); await retry;
  assert.equal(h.toasts.length, 1); assert.deepEqual(h.updates, [{ nickname: '新昵称' }]);
});
for (const boundary of ['关闭', '换账号']) test(boundary + '后上传不能继续发起资料写入', async () => {
  const h = harness(), op = h.render(); const p = op.uploadAvatar({});
  if (boundary === '关闭') h.unmount(); else h.switchAccount();
  h.uploads[0].resolve({ avatarUrl: '/new.png' }); await p; assert.equal(h.writes.length, 0); assert.equal(h.updates.length, 0);
});
test('关闭后丢弃已排队写入和迟到回执，提示已发请求不能撤回', async () => {
  const h = harness(), op = h.render(); op.editName('甲'); const a = op.saveName('甲'); await tick();
  op.editName('乙'); const b = op.saveName('乙'); h.unmount();
  h.writes[0].resolve({ nickname: '甲' }); await Promise.all([a, b]);
  assert.equal(h.writes.length, 1); assert.equal(h.updates.length, 0); assert.match(h.toasts[0][1], /不能撤回/);
});

