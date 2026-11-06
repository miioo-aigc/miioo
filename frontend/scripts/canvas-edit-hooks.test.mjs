import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import * as assets from '../src/components/canvas/CanvasAssets.js';
import * as edits from '../src/components/canvas/CanvasImageEdits.js';
import { getCanvasOperationLocks, guardCanvasSystemUpdate, guardCanvasNodeUpdate } from '../src/components/canvas/CanvasOperationGuards.js';

const oldId = '10000000-0000-0000-0000-000000000001';
const newId = '20000000-0000-0000-0000-000000000001';
const node = (type = 'image') => ({ id: 'source', type, data: { asset: { asset_id: oldId, asset_type: type, url: '/old' } } });

function mount(file, initial, overrides = {}) {
  let nodes = initial, editor;
  const writes = [], toasts = [];
  const effects = [];
  const source = readFileSync(new URL(`../src/components/canvas/${file}.js`, import.meta.url), 'utf8')
    .replace(/^import .*;$/mg, '').replace(/export /g, '');
  const name = file === 'UseCanvasImageEdits' ? 'useCanvasImageEdits' : 'useCanvasVideoEdits';
  const api = runInNewContext(source + ';' + name, {
    ...assets, ...edits, crypto, getCanvasOperationLocks, useCallback: (fn) => fn, useEffect: (fn) => effects.push(fn),
    useRef: (current) => ({ current }), useState: () => [null, (value) => { editor = value; }],
    prepareCanvasMediaAsset: async (asset) => asset, getAuthSessionGeneration: () => 1,
    showGlobalToast: (...args) => toasts.push(args), ...overrides,
  });
  const result = api({ nodes, canvasId: 'canvas', cancelPendingClicks: () => {},
    setNodes: (update, options = {}) => {
      writes.push(options);
      const next = typeof update === 'function' ? update(nodes) : update;
      const guarded = options.origin === 'system' ? guardCanvasSystemUpdate(nodes, next)
        : guardCanvasNodeUpdate(nodes, next, { origin: options.origin });
      const accepted = guarded !== nodes;
      nodes = guarded;
      return accepted;
    } });
  effects.forEach((effect) => effect());
  return { result, writes, toasts, get editor() { return editor; }, get nodes() { return nodes; }, replace: (next) => { nodes = next; } };
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
});

test('视频编辑回原节点，选帧独立新增且不污染视频历史，删除后不复活', async () => {
  for (const mode of ['trim', 'frame_extract']) {
    const hook = mount('UseCanvasVideoEdits', [node('video')], {
      runVideoEdit: async () => ({ id: newId, asset_id: newId, video_url: '/new', original_url: '/frame' }),
    });
    hook.result.open('source', mode);
    await hook.editor.submit(hook.editor.sourceAsset, { mode });
    assert.equal(hook.nodes.length, mode === 'trim' ? 1 : 2);
    assert.equal(hook.nodes[0].data.asset.asset_id, mode === 'trim' ? newId : oldId);
    if (mode === 'frame_extract') {
      assert.equal(hook.nodes[0].data.nodeResults, undefined);
      assert.equal(hook.nodes[1].type, 'image');
      assert.equal(hook.nodes[1].data.asset.asset_id, newId);
    }
    assert.equal(hook.toasts.some((toast) => toast[1] === 'success'), true);
  }
  let resolve;
  const hook = mount('UseCanvasVideoEdits', [node('video')], { runVideoEdit: () => new Promise((done) => { resolve = done; }) });
  hook.result.open('source', 'trim');
  const saving = hook.editor.submit(hook.editor.sourceAsset, { mode: 'trim' });
  hook.replace([]);
  resolve({ id: newId, asset_id: newId, video_url: '/new' });
  await saving;
  assert.equal(hook.nodes.length, 0);
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
