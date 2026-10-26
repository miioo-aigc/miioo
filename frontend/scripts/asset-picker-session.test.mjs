import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../src/components/AssetPickerModal.jsx', import.meta.url), 'utf8');
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function fixture(callback) {
  const request = deferred(), session = { current: 0 }, busy = { current: false };
  let auth = 0, calls = 0, closes = 0, error = '', confirming = false;
  const asset = { id: 'asset', isSeedanceMaterial: true };
  const body = source.slice(source.indexOf('  const handleConfirm = async'), source.indexOf('  const handleSelectProject'));
  const bindings = {
    confirmBusyRef: busy, creativeSessionRef: session, getAuthSessionGeneration: () => auth,
    setConfirmError: value => { error = value; }, setConfirming: value => { confirming = value; },
    projectAssetsMap: { project: { chars: [asset] } }, creativeAssets: {}, seedanceAssets: [],
    selected: new Set(['asset']), preSelectedSet: new Set(),
    apiGetLiveMaterialAsset: () => request.promise, unwrapLiveMaterialAsset: value => value,
    toSeedancePickerAsset: value => value, validateSelection: () => true,
    onConfirm: async assets => { calls++; return callback?.(assets); },
    handleRequestClose: () => { closes++; session.current++; }, console: { warn() {}, error() {} },
  };
  const confirm = new Function(...Object.keys(bindings), body + String.fromCharCode(10) + 'return handleConfirm;')(...Object.values(bindings));
  return { confirm, request, close: () => { session.current++; }, switchAccount: () => { auth++; },
    snapshot: () => ({ calls, closes, error, confirming, busy: busy.current }) };
}
test('补全详情至回填全程阻止重复确认', async () => {
  const f = fixture(), pending = f.confirm();
  await f.confirm();
  assert.equal(f.snapshot().busy, true);
  f.request.resolve({ id: 'asset' }); await pending;
  assert.equal(f.snapshot().calls, 1);
  assert.equal(f.snapshot().closes, 1);
});
for (const action of ['close', 'switchAccount']) {
  for (const result of ['resolve', 'reject']) {
    test('旧确认不得回填或关闭：' + action + '/' + result, async () => {
      const f = fixture(), pending = f.confirm();
      f[action]();
      f.request[result](result === 'reject' ? new Error('迟到失败') : { id: 'asset' });
      await pending;
      assert.equal(f.snapshot().calls, 0);
      assert.equal(f.snapshot().closes, 0);
    });
  }
}
test('调用方失败保留弹窗，显示错误并释放确认锁', async () => {
  const f = fixture(() => { throw new Error('断网'); }), pending = f.confirm();
  f.request.resolve({ id: 'asset' }); await pending;
  assert.deepEqual(f.snapshot(), { calls: 1, closes: 0, error: '素材确认失败，请检查后重试', confirming: false, busy: false });
});
test('调用方迟到回执不能关闭重新打开的弹窗', async () => {
  const receipt = deferred(), f = fixture(() => receipt.promise), pending = f.confirm();
  f.request.resolve({ id: 'asset' });
  await new Promise(resolve => setImmediate(resolve));
  f.close(); receipt.resolve(); await pending;
  assert.equal(f.snapshot().calls, 1);
  assert.equal(f.snapshot().closes, 0);
});
test('当前会话详情失败保留既有列表降级规则', async () => {
  const f = fixture(), pending = f.confirm();
  f.request.reject(new Error('临时失败')); await pending;
  assert.equal(f.snapshot().calls, 1);
});

function readFixture(kind, enrich = async (_id, items) => items) {
  const request = deferred();
  let cleanup, auth = 0, writes = 0, requests = 0, error = '', loading = false;
  let errors = {}, loadingKeys = new Set();
  const project = kind === 'project';
  const start = project ? source.indexOf('  // 切换 Tab 时一次性拉取') : source.indexOf('  useEffect(() => {', source.indexOf('}, [open, activeTab, showSeedanceTab'));
  const end = project ? source.indexOf('  // 创作资产按类型独立分页') : source.indexOf('  // ── 从后端拉取真实数据', start);
  const bindings = {
    useEffect: fn => { cleanup = fn(); }, open: true, activeTab: project ? 'project' : 'seedance',
    activeProjectId: 'project', projectId: 'project', activeSeedanceGroup: { id: 'group' }, seedanceRetry: 0,
    projectSubTab: '角色', SUB_TAB_KEY_MAP: { '角色': 'chars' }, SUB_TAB_CATEGORY_MAP: { '角色': { category: 'character' } },
    pickerTabKey: (id, tab) => id + '__' + tab, loadedTabKeys: new Set(), accept: 'image', projectTabRetry: 0,
    getAuthSessionGeneration: () => auth,
    setLoadingTabKeys: fn => { loadingKeys = fn(loadingKeys); }, setProjectTabErrors: fn => { errors = fn(errors); },
    apiGetAssetsPage: () => { requests++; return request.promise; }, enrichWithStoryboards: enrich,
    dedupePickerAssets: value => value, normalizePickerAsset: value => value,
    setApiAssetsMap: () => { writes++; }, setLoadedTabKeys: () => {}, console: { error() {} },
    setSeedanceAssets: items => { if (items.length) writes++; }, setSeedanceLoading: value => { loading = value; },
    setSeedanceError: value => { error = value; }, toSeedancePickerAsset: value => value,
    apiListLiveMaterialAssets: () => { requests++; return request.promise; },
  };
  new Function(...Object.keys(bindings), source.slice(start, end))(...Object.values(bindings));
  return { request, stop: () => cleanup(), switchAccount: () => { auth++; },
    snapshot: () => ({ writes, requests, errors, loadingKeys, error, loading }) };
}
test('补全失败不写成功缓存，显示重试错误并释放加载状态', async () => {
  const f = readFixture('project', async () => { throw new Error('补全失败'); });
  f.request.resolve({ list: [{ id: 'asset' }], hasMore: false });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.snapshot().writes, 0);
  assert.ok(f.snapshot().errors.project__chars);
  assert.equal(f.snapshot().loadingKeys.size, 0);
});
test('选择器将会话检查传入补全内部', async () => {
  let check;
  const pending = deferred();
  const f = readFixture('project', async (_id, items, _needed, options) => {
    check = options.isCurrent;
    await pending.promise;
    return items;
  });
  f.request.resolve({ list: [{ id: 'asset' }], hasMore: false });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(check(), true); f.stop(); assert.equal(check(), false);
  pending.resolve();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.snapshot().writes, 0);
});
for (const kind of ['project', 'seedance']) {
  test('读取失败不写成功空数据，并记录可重试错误：' + kind, async () => {
    const f = readFixture(kind);
    f.request.reject(new Error('弱网'));
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(f.snapshot().writes, 0);
    assert.ok(kind === 'project' ? f.snapshot().errors.project__chars : f.snapshot().error);
    assert.equal(f.snapshot().loadingKeys.size, 0);
    assert.equal(f.snapshot().loading, false);
  });
  for (const action of ['stop', 'switchAccount']) {
    test('失效读取不翻下一页、不写回：' + kind + '/' + action, async () => {
      const f = readFixture(kind); f[action]();
      f.request.resolve(kind === 'project' ? { list: [{ id: 'old' }], hasMore: true, nextCursor: 'next' } : [{ id: 'old' }]);
      await new Promise(resolve => setImmediate(resolve));
      assert.equal(f.snapshot().writes, 0);
      assert.equal(f.snapshot().requests, 1);
    });
  }
}
