import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import * as assets from '../src/components/canvas/CanvasAssets.js';
import * as edits from '../src/components/canvas/CanvasImageEdits.js';
import * as scopes from '../src/utils/CreationEditScope.js';
import { getCanvasOperationLocks, guardCanvasSystemUpdate, guardCanvasNodeUpdate } from '../src/components/canvas/CanvasOperationGuards.js';

const oldId = '10000000-0000-0000-0000-000000000001';
const newId = '20000000-0000-0000-0000-000000000001';
const node = (type = 'image') => ({ id: 'source', type, data: { asset: { asset_id: oldId, asset_type: type, url: '/old' } } });

test('图片提交准备阶段即启动节点动画，关闭弹窗及轮询期间保持，完成后清理', async () => {
  let resolve;
  const hook = mount('UseCanvasImageEdits', [node()], {
    savePendingImage: () => new Promise((done) => { resolve = done; }),
  });
  hook.result.open('source', '局部重绘');
  const editor = hook.editor;
  const finish = editor.onSave.beginSubmission();
  const operation = hook.nodes[0].data.canvasEditOperation;
  assert.ok(operation);
  hook.result.close();
  assert.equal(hook.nodes[0].data.canvasEditOperation, operation);
  const saving = editor.onSave.pending({});
  assert.equal(hook.nodes[0].data.canvasEditOperation, operation);
  resolve({ id: newId, asset_id: newId, originalUrl: '/new' });
  await saving;
  finish();
  assert.equal(hook.nodes[0].data.canvasEditOperation, undefined);
  assert.equal(hook.nodes[0].data.asset.asset_id, newId);
});

test('图片提交准备失败可清理节点动画，未提交时关闭不启动动画', () => {
  const hook = mount('UseCanvasImageEdits', [node()]);
  hook.result.open('source', '局部重绘');
  const finish = hook.editor.onSave.beginSubmission();
  assert.equal(hook.nodes[0].data.editing, true);
  finish();
  assert.equal(hook.nodes[0].data.editing, undefined);
});

test('画布图片保存使用账号范围，业务目标保留源资产，裁剪翻转均可回写', async () => {
  for (const mode of ['裁剪', '翻转']) {
    const calls = [];
    const hook = mount('UseCanvasImageEdits', [node()], {
      savePendingImage: async (...args) => {
        calls.push(args);
        return { id: newId, asset_id: newId, originalUrl: '/new' };
      },
    });
    hook.result.open('source', mode);
    assert.equal(hook.editor.onSave.scope, `creation:owner:account-a:${oldId}`);
    assert.equal(hook.editor.onSave.destinationScope, `creation:${oldId}`);
    assert.equal(hook.editor.onSave.canvasId, 'canvas');
    const pending = { image: { asset_id: newId } };
    await hook.editor.onSave.pending(pending);
    assert.equal(calls[0][0], hook.editor.onSave.scope);
    assert.equal(calls[0][1], pending);
    assert.equal(hook.nodes[0].data.asset.asset_id, newId);
    assert.deepEqual(hook.assetsChanged, ['canvas']);
  }
});

test('账号未就绪时提前阻止打开编辑器', () => {
  const hook = mount('UseCanvasImageEdits', [node()], {
    useCreationStore: Object.assign((select) => select({ ownerId: null }), { getState: () => ({ ownerId: null }) }),
  });
  hook.result.open('source', '裁剪');
  assert.equal(hook.editor, undefined);
  assert.match(hook.toasts[0][0], /账号信息尚未就绪/);
});

test('账号或会话变化后阻止保存和异步结果回写，包括图片尺寸读取期间', async () => {
  for (const phase of ['before', 'save', 'prepare']) {
    for (const change of ['owner', 'session']) {
      let ownerId = 'account-a', session = 1, resolve, calls = 0;
      const deferred = () => new Promise((done) => { resolve = done; });
      const image = { id: newId, asset_id: newId, originalUrl: '/new' };
      const hook = mount('UseCanvasImageEdits', [node()], {
        useCreationStore: Object.assign((select) => select({ ownerId }), { getState: () => ({ ownerId }) }),
        getAuthSessionGeneration: () => session,
        savePendingImage: () => { calls++; return phase === 'save' ? deferred() : Promise.resolve(image); },
        prepareCanvasMediaAsset: phase === 'prepare' ? deferred : async (value) => value,
      });
      hook.result.open('source', '裁剪');
      const switchAccount = () => { if (change === 'owner') ownerId = 'account-b'; else session++; };
      if (phase === 'before') switchAccount();
      const saving = hook.editor.onSave.pending({});
      if (phase !== 'before') {
        await new Promise((done) => setImmediate(done));
        switchAccount();
        resolve(image);
      }
      await assert.rejects(saving, { name: 'AbortError' });
      assert.equal(hook.nodes[0].data.asset.asset_id, oldId);
      assert.deepEqual(hook.assetsChanged, []);
      if (phase === 'before') assert.equal(calls, 0);
    }
  }
});

function mount(file, initial, overrides = {}) {
  let nodes = initial, editor;
  const writes = [], toasts = [], assetsChanged = [];
  const effects = [];
  const refs = [];
  const source = readFileSync(new URL(`../src/components/canvas/${file}.js`, import.meta.url), 'utf8')
    .replace(/^import .*;$/mg, '').replace(/export /g, '');
  const name = file === 'UseCanvasImageEdits' ? 'useCanvasImageEdits' : 'useCanvasVideoEdits';
  const api = runInNewContext(source + ';' + name, {
    ...assets, ...edits, ...scopes, crypto, DOMException, getCanvasOperationLocks, useCallback: (fn) => fn, useEffect: (fn) => effects.push(fn),
    useCreationStore: Object.assign((select) => select({ ownerId: 'account-a' }), { getState: () => ({ ownerId: 'account-a' }) }),
    useRef: (current) => { const ref = { current }; refs.push(ref); return ref; }, useState: () => [null, (value) => { editor = value; }],
    prepareCanvasMediaAsset: async (asset) => asset, getAuthSessionGeneration: () => 1,
    showGlobalToast: (...args) => toasts.push(args),
    dispatchCanvasAssetsChanged: (...args) => assetsChanged.push(...args), ...overrides,
  });
  const result = api({ nodes, canvasId: 'canvas', cancelPendingClicks: () => {},
    setNodes: (update, options = {}) => {
      writes.push(options);
      const next = typeof update === 'function' ? update(nodes) : update;
      const guarded = options.origin === 'system' ? guardCanvasSystemUpdate(nodes, next)
        : guardCanvasNodeUpdate(nodes, next, { origin: options.origin });
      const accepted = guarded !== nodes;
      refs.filter((ref) => ref.current === nodes).forEach((ref) => { ref.current = guarded; });
      nodes = guarded;
      return accepted;
    } });
  effects.forEach((effect) => effect());
  return {
    result,
    writes,
    toasts,
    assetsChanged,
    get editor() { return editor; },
    get nodes() { return nodes; },
    replace: (next) => { nodes = next; },
  };
}

test('首传成功后独立批量导入每个节点补交一次上传批次', () => {
  const initial = ['image', 'video'].map((type) => {
    const item = node(type);
    item.id = type;
    item.data.asset = { ...item.data.asset, source: 'local-upload', uploadStatus: 'ready' };
    return item;
  });
  const hook = mount('UseCanvasImageEdits', initial);
  for (const item of hook.nodes) {
    assert.equal(item.data.nodeResults.batches.length, 1);
    assert.equal(item.data.nodeResults.batches[0].source, 'upload');
  }
});

test('图片保存晚到时拒绝覆盖新资产', async () => {
  let resolve;
  const hook = mount('UseCanvasImageEdits', [node()], {
    savePendingImage: () => new Promise((done) => { resolve = done; }),
  });
  hook.result.open('source', '裁剪');
  const saving = hook.editor.onSave.pending({});
  hook.replace([{ ...node(), data: { asset: { ...node().data.asset, asset_id: newId } } }]);
  resolve({ id: 'pending-edit:local', creationAssetId: newId, originalUrl: '/new' });
  await assert.rejects(saving, /未写回/);
  assert.equal(hook.nodes[0].data.nodeResults, undefined);
  assert.equal(hook.nodes[0].data.asset.asset_id, newId);
  assert.deepEqual(hook.assetsChanged, []);
});

test('视频编辑回原节点，选帧独立新增且不污染视频历史，删除后不复活', async () => {
  for (const mode of ['trim', 'frame_extract']) {
    const calls = [];
    const hook = mount('UseCanvasVideoEdits', [node('video')], {
      runVideoEdit: async (...args) => {
        calls.push(args);
        return { id: newId, asset_id: newId, video_url: '/new', original_url: '/frame' };
      },
    });
    hook.result.open('source', mode);
    assert.equal(hook.editor.sourceAsset.canvas_id, 'canvas');
    assert.equal(hook.editor.sourceAsset.canvasEditScope, 'canvas:source');
    await hook.editor.submit(hook.editor.sourceAsset, { mode });
    assert.equal(calls[0][0].canvas_id, 'canvas');
    assert.equal(Object.hasOwn(calls[0][1], 'canvasEditScope'), false);
    assert.equal(hook.nodes.length, mode === 'trim' ? 1 : 2);
    assert.equal(hook.nodes[0].data.asset.asset_id, mode === 'trim' ? newId : oldId);
    if (mode === 'frame_extract') {
      assert.equal(hook.nodes[0].data.nodeResults, undefined);
      assert.equal(hook.nodes[1].type, 'image');
      assert.equal(hook.nodes[1].data.asset.asset_id, newId);
    }
    assert.equal(hook.toasts.some((toast) => toast[1] === 'success'), true);
    assert.deepEqual(hook.assetsChanged, ['canvas']);
  }
  let resolve;
  const hook = mount('UseCanvasVideoEdits', [node('video')], { runVideoEdit: () => new Promise((done) => { resolve = done; }) });
  hook.result.open('source', 'trim');
  const saving = hook.editor.submit(hook.editor.sourceAsset, { mode: 'trim' });
  hook.replace([]);
  resolve({ id: newId, asset_id: newId, video_url: '/new' });
  await saving;
  assert.equal(hook.nodes.length, 0);
  assert.deepEqual(hook.assetsChanged, []);
});

test('替换上传接管暂存文件，沿用画布项目归属，成功后提交', async () => {
  const original = node();
  const pending = assets.applyCanvasAsset([original], original.id, {
    asset_type: 'image', source: 'local-upload', url: 'blob:replace',
    file: new File(['图片'], '替换.png'), uploadStatus: 'uploading',
  });
  const calls = [];
  const hook = mount('UseCanvasImageEdits', pending, {
    apiGetCanvasDocument: async () => ({ project_id: 'project' }),
    uploadCanvasAsset: async (...args) => { calls.push(args); return { asset_id: newId, asset_type: 'image', url: '/new', name: '替换.png' }; },
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls.length, 1);
  assert.equal(calls[0][2].projectId, 'project');
  assert.equal(hook.nodes[0].data.nodeResults.batches.length, 2);
  assert.equal(hook.nodes[0].data.asset.asset_id, newId);
  assert.equal(hook.nodes[0].data.label, '替换');
});

test('仅打开关闭编辑器不设置任务状态，保存期间设置并在成功或失败后清理', async () => {
  for (const file of ['UseCanvasImageEdits', 'UseCanvasVideoEdits']) {
    for (const fail of [false, true]) {
      let resolve;
      const pending = () => new Promise((done, reject) => { resolve = fail ? () => reject(new Error('失败')) : done; });
      const hook = mount(file, [node(file === 'UseCanvasImageEdits' ? 'image' : 'video')],
        { savePendingImage: pending, runVideoEdit: pending });
      hook.result.open('source', 'trim');
      assert.equal(hook.nodes[0].data.editing, undefined);
      const editor = hook.editor;
      hook.result.close();
      assert.equal(hook.nodes[0].data.editing, undefined);
      const saving = file === 'UseCanvasImageEdits' ? editor.onSave.pending({})
        : editor.submit(editor.sourceAsset, { mode: 'trim' });
      assert.equal(hook.nodes[0].data.editing, true);
      hook.result.close();
      assert.equal(hook.nodes[0].data.editing, true);
      resolve({ id: newId, asset_id: newId, video_url: '/new', originalUrl: '/new' });
      if (fail) await assert.rejects(saving, /失败/);
      else await saving;
      assert.equal(hook.nodes[0].data.editing, undefined);
      assert.equal(hook.nodes[0].data.canvasEditOperation, undefined);
      assert.ok(hook.writes.every((options) => options.origin === 'system'));
      if (fail) assert.deepEqual(hook.assetsChanged, []);
    }
  }
});

test('运行期间新增下游执行锁，图片视频回写都拒绝且视频不提示成功', async () => {
  for (const file of ['UseCanvasImageEdits', 'UseCanvasVideoEdits']) {
    let resolve;
    const pending = () => new Promise((done) => { resolve = done; });
    const hook = mount(file, [node(file === 'UseCanvasImageEdits' ? 'image' : 'video')],
      { savePendingImage: pending, runVideoEdit: pending });
    hook.result.open('source', 'trim');
    const saving = file === 'UseCanvasImageEdits' ? hook.editor.onSave.pending({})
      : hook.editor.submit(hook.editor.sourceAsset, { mode: 'trim' });
    hook.replace([...hook.nodes, { id: 'downstream', data: { submissionLocked: true, executionSourceIds: ['source'] } }]);
    resolve({ id: newId, asset_id: newId, video_url: '/new', originalUrl: '/new' });
    if (file === 'UseCanvasImageEdits') await assert.rejects(saving, /未写回/);
    else assert.equal(await saving, undefined);
    assert.equal(hook.nodes[0].data.asset.asset_id, oldId);
    assert.equal(hook.nodes[0].data.editing, undefined);
    assert.equal(hook.toasts.some((toast) => toast[1] === 'success'), false);
    assert.deepEqual(hook.assetsChanged, []);
  }
});

test('视频结果缺少永久编号或源已删除时不提示成功', async () => {
  for (const remove of [false, true]) {
    let resolve;
    const hook = mount('UseCanvasVideoEdits', [node('video')], { runVideoEdit: () => new Promise((done) => { resolve = done; }) });
    hook.result.open('source', 'trim');
    const saving = hook.editor.submit(hook.editor.sourceAsset, { mode: 'trim' });
    if (remove) hook.replace([]);
    resolve({ id: 'temporary-result', video_url: '/new' });
    assert.equal(await saving, undefined);
    assert.equal(hook.toasts.some((toast) => toast[1] === 'success'), false);
    assert.deepEqual(hook.assetsChanged, []);
  }
});

test('打开编辑后新出现上游锁，提交前拒绝任务且不留下编辑状态', async () => {
  for (const file of ['UseCanvasImageEdits', 'UseCanvasVideoEdits']) {
    let calls = 0;
    const work = async () => { calls++; };
    const hook = mount(file, [node(file === 'UseCanvasImageEdits' ? 'image' : 'video')],
      { savePendingImage: work, runVideoEdit: work });
    hook.result.open('source', 'trim');
    hook.replace([...hook.nodes, { id: 'downstream', data: { submissionLocked: true, executionSourceIds: ['source'] } }]);
    const saving = file === 'UseCanvasImageEdits' ? hook.editor.onSave.pending({})
      : hook.editor.submit(hook.editor.sourceAsset, { mode: 'trim' });
    await assert.rejects(saving, /任务保护/);
    assert.equal(calls, 0);
    assert.equal(hook.nodes[0].data.editing, undefined);
  }
});

test('替换上传完成时重算上游锁，不提交受保护节点的输出', async () => {
  let resolve;
  const original = node();
  const pending = assets.applyCanvasAsset([original], original.id, {
    asset_type: 'image', source: 'local-upload', url: 'blob:replace',
    file: new File(['图片'], '替换.png'), uploadStatus: 'uploading',
  });
  const hook = mount('UseCanvasImageEdits', pending, {
    apiGetCanvasDocument: async () => ({ project_id: 'project' }),
    uploadCanvasAsset: () => new Promise((done) => { resolve = done; }),
  });
  await new Promise((done) => setImmediate(done));
  hook.replace([...hook.nodes, { id: 'downstream', data: { submissionLocked: true, executionSourceIds: ['source'] } }]);
  resolve({ asset_id: newId, asset_type: 'image', url: '/new' });
  await new Promise((done) => setImmediate(done));
  assert.equal(hook.nodes[0].data.asset.asset_id, oldId);
  assert.equal(hook.nodes[0].data.nodeResults, undefined);
  assert.ok(hook.writes.every((options) => options.origin === 'system'));
});
