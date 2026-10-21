import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { accountCreationEditScope, creationEditOwner, accountImageEditScope, imageEditOwner, imageEditBusinessScope } from '../src/utils/CreationEditScope.js';
import { createCreationHistoryVisit } from '../src/utils/CreationHistoryScope.js';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
test('创作编辑按账号隔离，特殊字符不碰撞，非创作作用域保持原样', () => {
  const a = accountCreationEditScope('creation:asset:1', '甲:乙');
  assert.equal(creationEditOwner(a), '甲:乙');
  assert.notEqual(a, accountCreationEditScope('creation:asset:1', '甲%3A乙'));
  assert.equal(accountCreationEditScope(a, '甲:乙'), a);
  assert.equal(accountCreationEditScope(a, '乙'), null);
  assert.equal(accountCreationEditScope('creation:1', null), null);
  assert.equal(creationEditOwner('creation:1'), null);
  assert.equal(creationEditOwner('creation:owner:%ZZ:1'), null);
  assert.equal(accountCreationEditScope('subject:1:2', '甲'), 'subject:1:2');
});

function imageFixture() {
  const state = { ownerId: '乙', generationsByTab: { image: [] },
    addGeneration: (_tab, item) => state.generationsByTab.image.push(item),
    deleteGeneration: (_tab, id) => { state.generationsByTab.image = state.generationsByTab.image.filter(item => item.id !== id); } };
  const store = { getState: () => state };
  const source = read('../src/stores/CreationImageEdits.js').replace(/^import .*;\n/gm, '').replaceAll('export function', 'function');
  return { state, ...new Function('useCreationStore', 'creationEditOwner', source + '\nreturn { syncCreationImageEdit, removeCreationImageEdit };')(store, creationEditOwner) };
}
test('实际编辑同步拒绝旧账号和无归属记录，原账号重新进入可同步', () => {
  const f = imageFixture();
  const image = { id: '1', scope: accountCreationEditScope('creation:1', '甲'), status: 'done' };
  f.syncCreationImageEdit(image);
  f.syncCreationImageEdit({ ...image, scope: 'creation:1' });
  assert.equal(f.state.generationsByTab.image.length, 0);
  f.state.ownerId = '甲';
  f.syncCreationImageEdit(image);
  assert.equal(f.state.generationsByTab.image.length, 1);
  f.removeCreationImageEdit({ ...image, scope: accountCreationEditScope('creation:1', '乙') });
  assert.equal(f.state.generationsByTab.image.length, 1);
  f.removeCreationImageEdit(image);
  assert.equal(f.state.generationsByTab.image.length, 0);
});

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function favoriteFixture() {
  let owner = '甲', session = 1, liked = false, pending = false, confirms = 0, rollbacks = 0;
  const request = deferred();
  const visit = createCreationHistoryVisit(owner, session, () => owner, () => session);
  const state = { get ownerId() { return owner; }, get pendingFavoriteToggles() { return new Set(pending ? ['卡'] : []); },
    confirmFavoriteToggle() { pending = false; confirms++; },
    rollbackFavoriteToggle() { pending = false; liked = !liked; rollbacks++; } };
  const source = read('../src/components/assets/AssetsCreativePanel.jsx');
  const body = source.slice(source.indexOf('  function toggleStar('), source.indexOf('  async function deleteSingle('));
  const toggle = new Function('visitRef', 'useCreationStore', 'favorites', 'storeToggleFavorite', 'setAudioDetail',
    'showToast', 'activeType', 'apiToggleVideoFavorite', 'apiToggleAudioFavorite', 'apiToggleImageFavorite',
    'createCreationHistoryVisit', 'getAuthSessionGeneration', body + '\nreturn toggleStar;')(
    { current: visit }, { getState: () => state }, new Set(), () => { liked = !liked; pending = true; },
    () => {}, () => {}, 'image', () => request.promise, () => request.promise, () => request.promise,
    createCreationHistoryVisit, () => session);
  return { toggle, request, switchAccount: () => { owner = '乙'; }, relogin: () => { session++; },
    leave: () => visit.stop(), snapshot: () => ({ liked, pending, confirms, rollbacks }) };
}
test('实际收藏成功释放等待标记，并阻止同卡重复提交', async () => {
  const f = favoriteFixture();
  f.toggle('卡', '1'); f.toggle('卡', '1');
  assert.equal(f.snapshot().liked, true);
  f.request.resolve();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(f.snapshot(), { liked: true, pending: false, confirms: 1, rollbacks: 0 });
});
test('实际收藏失败回滚并释放等待标记', async () => {
  const f = favoriteFixture(); f.toggle('卡', '1'); f.request.reject(new Error('弱网'));
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(f.snapshot(), { liked: false, pending: false, confirms: 0, rollbacks: 1 });
});
test('只离开面板不切账号，收藏回执仍释放共享等待标记', async () => {
  const f = favoriteFixture(); f.toggle('卡', '1'); f.leave(); f.request.resolve();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.snapshot().pending, false);
});
for (const change of ['switchAccount', 'relogin']) {
  test('实际收藏迟到失败不回滚新会话：' + change, async () => {
    const f = favoriteFixture(); f.toggle('卡', '1'); f[change](); f.request.reject(new Error('迟到失败'));
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(f.snapshot().rollbacks, 0);
  });
}

function localFixture() {
  const db = new Map();
  let owner = '甲', session = 1, resolves = 0, failRemoval = false;
  const result = deferred();
  let source = read('../src/stores/LocalImageEdits.js').replace(/^import .*;\n/gm, '')
    .replaceAll('export ', '');
  source = source.slice(0, source.indexOf('function openDatabase()'))
    + source.slice(source.indexOf('function materialize('));
  const create = init => {
    let state = init();
    return { getState: () => state, setState: update => { state = { ...state, ...update(state) }; } };
  };
  const transact = async (_mode, action) => {
    const requests = [];
    const result = action({
    put: row => { if (row.removed && failRemoval) throw new Error('落盘失败'); db.set(row.id, structuredClone(row)); return row.id; },
    get: id => { const request = { result: structuredClone(db.get(id)) }; requests.push(request); return request; }, delete: id => db.delete(id),
    index: () => ({ getAll: scope => [...db.values()].filter(row => row.scope === scope) }),
    });
    requests.forEach(request => request.onsuccess?.());
    return structuredClone(result && 'result' in Object(result) ? result.result : result);
  };
  const api = new Function('create', 'transact', 'imageEditOwner', 'useCreationStore',
    'getAuthSessionGeneration', 'apiResolveImageEdit', 'normalizeEditedImage', 'bindImageEditResult',
    'syncCreationImageEdit', 'removeCreationImageEdit', 'showGlobalToast', 'downloadUrlWithFeedback', 'imageEditSessionCheck', 'createImageEditRemovalChannel',
    source + '\nreturn { savePendingImage, loadLocalImages, saveLocalImage, removeLocalImage, localImagesFor, useLocalImageEditStore, verifyImageEditRemoval, reconcileImageEditRemovals };')(
    create, transact, imageEditOwner, { getState: () => ({ ownerId: owner }) }, () => session,
    () => { resolves++; return result.promise; }, image => image, async image => image,
    () => {}, () => {}, () => {}, () => {}, () => { const original = session; return () => { if (original !== session) throw new DOMException('会话变化', 'AbortError'); }; }, () => ({ notify() {} }));
  return { ...api, db, result, owner: value => { owner = value; session++; }, resolves: () => resolves, failRemoval: value => { failRemoval = value; } };
}
test('实际本地入口：已受理迟到任务先持久化，切账号不请求、不删除', async () => {
  const f = localFixture(); f.owner('乙');
  const scope = accountCreationEditScope('creation:1', '甲');
  await f.savePendingImage(scope, { accepted: { task_id: '任务' }, mode: 'edit' });
  assert.equal(f.db.size, 1);
  assert.equal(f.resolves(), 0);
  assert.equal([...f.db.values()][0].abandoned, undefined);
});
test('实际本地入口：查询迟到保留结果，原账号重进继续保存，不重复查询', async () => {
  const f = localFixture();
  const scope = accountCreationEditScope('creation:1', '甲');
  const work = f.savePendingImage(scope, { accepted: { task_id: '任务' }, mode: 'edit' });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.resolves(), 1);
  f.owner('乙');
  f.result.resolve({ remoteUrl: 'https://example.test/result.png', originalUrl: 'result', id: '图片' });
  await work;
  assert.ok([...f.db.values()][0].image);
  assert.equal([...f.db.values()][0].pending, true);
  f.owner('甲');
  await f.loadLocalImages(scope);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.resolves(), 1);
  assert.equal([...f.db.values()][0].pending, undefined);
});
test('实际本地入口拒绝无归属任务，不读取或删除旧记录', async () => {
  const f = localFixture();
  f.db.set('旧记录', { id: '旧记录', scope: 'creation:1', pending: true });
  await f.loadLocalImages('creation:1');
  await assert.rejects(f.savePendingImage('creation:1', { accepted: { task_id: '任务' } }));
  assert.equal(f.db.size, 1);
  assert.equal(f.resolves(), 0);
});

for (const kind of ['subject', 'storyboard']) {
  test(kind + '：账号键与业务归属分离，旧键不自动认领', () => {
    const legacy = `${kind}:project:target`;
    const scope = accountImageEditScope(legacy, '甲:乙');
    assert.equal(imageEditOwner(scope), '甲:乙');
    assert.equal(imageEditBusinessScope(scope), legacy);
    assert.equal(accountImageEditScope(scope, '甲:乙'), scope);
    assert.equal(accountImageEditScope(scope, '乙'), null);
    assert.equal(accountImageEditScope(legacy, null), null);
    assert.notEqual(scope, accountImageEditScope(legacy, '甲%3A乙'));
  });
  test(kind + '：无归属旧任务保留但不恢复，其他账号不恢复，原账号可恢复', async () => {
    const f = localFixture();
    const legacy = `${kind}:project:target`;
    f.db.set('旧记录', { id: '旧记录', scope: legacy, pending: true });
    await f.loadLocalImages(legacy);
    await assert.rejects(f.savePendingImage(legacy, { accepted: { task_id: '旧任务' } }));
    assert.equal(f.resolves(), 0);
    const scope = accountImageEditScope(legacy, '甲');
    f.owner('乙');
    await f.savePendingImage(scope, { accepted: { task_id: '任务' }, mode: 'edit' });
    assert.equal(f.resolves(), 0);
    assert.equal(f.db.size, 2);
    f.owner('甲');
    await f.loadLocalImages(scope);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(f.resolves(), 1);
    f.result.resolve({ remoteUrl: 'https://example.test/image.png' });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal([...f.db.values()].find(row => row.scope === scope).pending, undefined);
    assert.ok(f.db.has('旧记录'));
  });
  test(kind + '：已完成图片按账号读取，旧账号回调不能删除或覆盖', async () => {
    const f = localFixture();
    const scope = accountImageEditScope(`${kind}:project:target`, '甲');
    const image = await f.saveLocalImage(scope, { remoteUrl: 'https://example.test/image.png' });
    assert.equal(f.localImagesFor(f.useLocalImageEditStore.getState(), scope).length, 1);
    f.owner('乙');
    assert.equal(f.localImagesFor(f.useLocalImageEditStore.getState(), scope).length, 0);
    await f.removeLocalImage(scope, image.id);
    await assert.rejects(f.saveLocalImage(scope, { remoteUrl: 'https://example.test/other.png' }));
    assert.ok(f.db.has(image.id));
    f.owner('甲');
    await f.loadLocalImages(scope);
    assert.equal(f.localImagesFor(f.useLocalImageEditStore.getState(), scope).length, 1);
  });
}

test('查询中移除：迟到结果和旧任务再次保存都不能复活本地记录', async () => {
  const f = localFixture();
  const scope = accountImageEditScope('subject:p:s', '甲');
  const pending = { accepted: { task_id: '任务' }, mode: 'edit' };
  const work = f.savePendingImage(scope, pending);
  await new Promise(resolve => setImmediate(resolve));
  const id = [...f.db.keys()][0];
  await f.removeLocalImage(scope, id);
  f.result.resolve({ remoteUrl: 'https://example.test/result.png' });
  await work;
  assert.equal(f.db.get(id).removed, true);
  assert.equal(f.localImagesFor(f.useLocalImageEditStore.getState(), scope).length, 0);
  await assert.rejects(f.savePendingImage(scope, pending), error => error.locallyRemoved);
  await assert.rejects(f.saveLocalImage(scope, { remoteUrl: 'https://example.test/result.png', pendingRecordId: id }), error => error.locallyRemoved);
  await f.loadLocalImages(scope, { retryPaused: true });
  assert.equal(f.resolves(), 1);
});

test('数据库删除标记刷新后仍有效；删除不启动恢复；落盘失败保留图片', async () => {
  const f = localFixture();
  const scope = accountImageEditScope('storyboard:p:s', '甲');
  const id = `pending-edit:${scope}:任务`;
  f.db.set(id, { id, scope, pending: true, created_at: new Date().toISOString(), accepted: { task_id: '任务' } });
  f.failRemoval(true);
  await assert.rejects(f.removeLocalImage(scope, id), /落盘失败/);
  assert.equal(f.db.get(id).pending, true);
  assert.equal(f.resolves(), 0);
  f.failRemoval(false);
  await f.removeLocalImage(scope, id);
  assert.equal(f.resolves(), 0);
  const refreshed = localFixture();
  refreshed.db.set(id, structuredClone(f.db.get(id)));
  await refreshed.loadLocalImages(scope);
  await assert.rejects(refreshed.savePendingImage(scope, { accepted: { task_id: '任务' } }), error => error.locallyRemoved);
  assert.equal(refreshed.resolves(), 0);
  assert.equal(refreshed.localImagesFor(refreshed.useLocalImageEditStore.getState(), scope).length, 0);
});

test('跨标签核验：虚假通知不移除，真实标记隐藏，其他账号不能触发', async () => {
  const f = localFixture();
  const scope = accountImageEditScope('subject:p:s', '甲');
  const image = await f.saveLocalImage(scope, { remoteUrl: 'https://example.test/image.png' });
  await f.verifyImageEditRemoval(scope, image.id);
  assert.equal(f.useLocalImageEditStore.getState().byScope[scope].length, 1);
  f.db.set(image.id, { id: image.id, scope, removed: true });
  f.owner('乙');
  await f.verifyImageEditRemoval(scope, image.id);
  assert.equal(f.useLocalImageEditStore.getState().byScope[scope].length, 1);
  f.owner('甲');
  await f.reconcileImageEditRemovals();
  assert.equal(f.useLocalImageEditStore.getState().byScope[scope].length, 0);
});

test('跨标签核验后停止原恢复，迟到结果不重建', async () => {
  const f = localFixture();
  const scope = accountImageEditScope('storyboard:p:s', '甲');
  const work = f.savePendingImage(scope, { accepted: { task_id: '跨页任务' } });
  await new Promise(resolve => setImmediate(resolve));
  const id = [...f.db.keys()][0];
  f.db.set(id, { id, scope, removed: true });
  await f.verifyImageEditRemoval(scope, id);
  f.result.resolve({ remoteUrl: 'https://example.test/image.png' });
  await work;
  assert.equal(f.db.get(id).removed, true);
  assert.equal(f.useLocalImageEditStore.getState().byScope[scope].length, 0);
});
