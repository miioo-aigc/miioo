import test from 'node:test';
import assert from 'node:assert/strict';
import { copyCanvasNodes, pasteCanvasNodes, duplicateCanvasNodes, deleteCanvasNodes } from '../src/components/canvas/CanvasNodeActions.js';
import { serializeCanvasFile, parseCanvasFile, mergeCanvasFile } from '../src/components/canvas/CanvasFile.js';
import { createCanvasHistory } from '../src/components/canvas/CanvasHistory.js';
import { createCanvasNodeResults, commitCanvasResultBatch, selectCanvasNodeResult, projectCanvasCurrentResult } from '../src/components/canvas/CanvasNodeResults.js';
import { resolveCanvasDocumentAssets } from '../src/components/canvas/CanvasAssetResolver.js';

const assetId = (index) => `12345678-1234-1234-1234-${String(index).padStart(12, '0')}`;
const batch = (type, index) => ({ id: `batch-${index}`, source: 'generation',
  requestedCount: type === 'image' ? 3 : 1, submittedAt: index, completedAt: index,
  taskIds: [`server-${index}`], snapshot: { inputIds: ['source', 'deleted-source'],
    referenceInputs: [{ sourceId: 'source', resultId: 'historical-input' }] },
  results: type === 'image' ? [
    { index: 0, status: 'failed' },
    { id: `result-${index}`, index: 1, type, assetId: assetId(index * 2) },
    { id: `candidate-${index}`, index: 2, type, assetId: assetId(index * 2 + 1) },
  ] : [{ id: `result-${index}`, index: 0, type,
    ...(type === 'text' ? { content: `正文${index}` } : { assetId: assetId(index) }) }],
});
function fixture(type = 'image') {
  let state = createCanvasNodeResults();
  state = commitCanvasResultBatch(state, batch(type, 0));
  state = commitCanvasResultBatch(state, batch(type, 1));
  state = selectCanvasNodeResult(state, 'result-0');
  return { id: 'target', type, selected: true, position: { x: 0, y: 0 },
    data: { label: '目标', prompt: '草稿', nodeResults: state, ...projectCanvasCurrentResult(state) } };
}
const source = () => ({ id: 'source', type: 'text', selected: true, position: { x: 300, y: 0 }, data: { label: '来源', content: '输入' } });
const append = (node, index) => {
  const nodeResults = commitCanvasResultBatch(node.data.nodeResults, batch(node.type, index));
  return { ...node, data: { ...node.data, nodeResults, ...projectCanvasCurrentResult(nodeResults) } };
};
const encode = (nodes) => JSON.stringify({ format: 'miioo-canvas', version: 1, nodes });

test('撤销重做接受页面任务保护，被拒绝时保留节点与历史栈', () => {
  const history = createCanvasHistory([fixture()]);
  history.setNodes(([node]) => [{ ...node, position: { x: 80, y: 0 } }]);
  const token = history.getUndoToken();
  history.undo((current) => current);
  assert.equal(history.getSnapshot().nodes[0].position.x, 80);
  assert.equal(history.getUndoToken(), token);
  history.undo();
  const redoToken = history.getRedoToken();
  assert.ok(redoToken);
  history.redo((current) => current);
  assert.equal(history.getRedoToken(), redoToken);
  assert.equal(history.getSnapshot().nodes[0].position.x, 0);
  assert.equal(history.getSnapshot().canRedo, true);
  history.redo();
  assert.equal(history.getRedoToken(), undefined);
  assert.equal(history.getSnapshot().nodes[0].position.x, 80);
  history.dispose();
});

test('三类节点复制完整历史白名单，隔离嵌套引用且不重映射历史输入', () => {
  for (const type of ['text', 'image', 'video']) {
    const node = fixture(type);
    Object.assign(node.data, { textSourceIds: ['source'], referenceInputs: [{ sourceId: 'source' }],
      generating: true, generationPending: true, generationRequestId: 'live',
      generationMessage: '处理中', generationProgress: 50, taskId: 'live-task', taskIds: ['live-task'], requestId: 'live-request',
      generationTaskIds: ['live-task'], executionSourceIds: ['source'], pendingCanvasUpload: { asset: { file: new Blob(['upload']) } },
      executionSnapshot: { prompt: '运行快照' }, taskIdentity: { requestId: 'live' },
      controller: new AbortController(), submissionLocked: true, upstreamProtected: true,
      resultAssetViews: { [assetId(0)]: { url: 'blob:runtime' } } });
    node.data.nodeResults.controller = new AbortController();
    node.data.nodeResults.batches[0].controller = new AbortController();
    node.data.nodeResults.batches[0].results[0].url = 'blob:runtime';
    const clipboard = copyCanvasNodes([node, source()]);
    const copied = clipboard[0];
    for (const field of ['generating', 'generationPending', 'generationRequestId', 'generationMessage',
      'generationProgress', 'taskId', 'taskIds', 'requestId', 'executionSnapshot', 'taskIdentity', 'controller',
      'generationTaskIds', 'executionSourceIds', 'pendingCanvasUpload',
      'submissionLocked', 'upstreamProtected', 'resultAssetViews']) assert.equal(copied.data[field], undefined, field);
    assert.equal(copied.data.nodeResults.controller, undefined);
    assert.equal(copied.data.nodeResults.batches[0].controller, undefined);
    assert.equal(copied.data.nodeResults.batches[0].results[0].url, undefined);
    assert.deepEqual(copied.data.nodeResults.batches[0].taskIds, ['server-0']);
    assert.equal(copied.data.nodeResults.currentResultId, 'result-0');
    const pasted = pasteCanvasNodes([], clipboard, { x: 0, y: 0 }, () => 'copy');
    assert.deepEqual(pasted[0].data.textSourceIds, ['canvas-text-copy']);
    assert.equal(pasted[0].data.referenceInputs[0].sourceId, 'canvas-text-copy');
    assert.equal(pasted[0].data.nodeResults.batches[0].snapshot.referenceInputs[0].sourceId, 'source');
    pasted[0].data.nodeResults.batches[0].snapshot.inputIds.push('new');
    pasted[0].data.nodeResults.batches[0].taskIds.push('new');
    assert.deepEqual(copied.data.nodeResults.batches[0].taskIds, ['server-0']);
    copied.data.nodeResults.batches[0].snapshot.inputIds.push('clipboard');
    assert.deepEqual(node.data.nodeResults.batches[0].snapshot.inputIds, ['source', 'deleted-source']);
    const duplicate = duplicateCanvasNodes([node], () => 'duplicate').at(-1);
    assert.equal(duplicate.data.nodeResults.batches.length, 2);
    assert.equal(duplicate.data.resultAssetViews, undefined);
  }
});

test('三类历史文件往返与重复导入，结果编号保留，运行映射由解析器重建', async () => {
  for (const type of ['text', 'image', 'video']) {
    const node = fixture(type);
    node.data.resultAssetViews = { secret: { url: 'blob:expired' } };
    const text = await serializeCanvasFile([node], '测试');
    assert.equal(text.includes('blob:expired'), false);
    const imported = parseCanvasFile(text);
    assert.deepEqual(imported[0].data.nodeResults, node.data.nodeResults);
    let id = 0;
    const merged = mergeCanvasFile(mergeCanvasFile([], imported, () => String(++id)), imported, () => String(++id));
    assert.equal(new Set(merged.map((item) => item.id)).size, 2);
    assert.equal(merged[1].data.nodeResults.currentResultId, 'result-0');
    const resolved = await resolveCanvasDocumentAssets('canvas', merged, async (_, ids) => ({
      items: ids.map((asset_id) => ({ asset_id, availability: 'ready', media_type: type, original_url: `/assets/${asset_id}` })),
    }));
    if (type !== 'text') {
      assert.equal(Object.keys(resolved[0].data.resultAssetViews).length, type === 'image' ? 4 : 2);
      assert.ok(resolved[0].data.asset.url);
    }
  }
});

test('文件拒绝损坏历史与冲突投影，非当前候选也校验，旧文件不自动迁移', () => {
  for (const mutate of [
    (n) => { n.data.nodeResults.batches[1].results[1].assetId = 'bad'; },
    (n) => { n.data.nodeResults.currentResultId = 'missing'; },
    (n) => { n.data.asset.asset_id = assetId(99); },
    (n) => { n.data.content = '冲突'; },
    (n) => { n.type = 'audio'; },
    (n) => { n.data.nodeResults = null; },
  ]) {
    const node = fixture();
    mutate(node);
    assert.throws(() => parseCanvasFile(encode([node])));
    assert.throws(() => copyCanvasNodes([node]));
  }
  assert.equal(parseCanvasFile(encode([source()]))[0].data.nodeResults, undefined);
});

test('普通编辑撤销重做保留异步批次及当前投影，结果切换不占撤销', () => {
  for (const type of ['text', 'image', 'video']) {
    const history = createCanvasHistory([fixture(type)]);
    history.setNodes(([node]) => [{ ...node, position: { x: 20, y: 0 }, data: { ...node.data, prompt: '修改草稿' } }]);
    history.setNodes(([node]) => [append(node, 2)], { record: false });
    history.undo();
    let current = history.getSnapshot().nodes[0];
    assert.equal(current.position.x, 0);
    assert.equal(current.data.prompt, '草稿');
    assert.equal(current.data.nodeResults.batches.length, 3);
    assert.equal(current.data.nodeResults.currentResultId, 'result-2');
    history.setNodes(([node]) => [append(node, 3)], { record: false });
    history.redo();
    current = history.getSnapshot().nodes[0];
    assert.equal(current.data.nodeResults.batches.length, 4);
    assert.equal(current.data.nodeResults.currentResultId, 'result-3');
    const token = history.getUndoToken();
    history.setNodes(([node]) => {
      const nodeResults = selectCanvasNodeResult(node.data.nodeResults, 'result-0');
      return [{ ...node, data: { ...node.data, nodeResults, ...projectCanvasCurrentResult(nodeResults) } }];
    });
    assert.equal(history.getUndoToken(), token);
    history.undo();
    assert.equal(history.getSnapshot().nodes[0].data.nodeResults.currentResultId, 'result-0');
    assert.deepEqual(history.getSnapshot().nodes[0].data.content, projectCanvasCurrentResult(history.getSnapshot().nodes[0].data.nodeResults).content);
    history.dispose();
  }
});

test('事务内多批异步返回不丢失，删除撤销及重做新增不复活运行任务', () => {
  const history = createCanvasHistory([fixture()]);
  history.begin();
  history.setNodes(([node]) => [{ ...node, position: { x: 50, y: 0 } }]);
  history.setNodes(([node]) => [append(node, 2)], { record: false });
  history.setNodes(([node]) => [append(node, 3)]);
  history.end();
  history.undo();
  assert.equal(history.getSnapshot().nodes[0].position.x, 0);
  assert.equal(history.getSnapshot().nodes[0].data.nodeResults.batches.length, 4);
  history.setNodes(([node]) => [{ ...node, data: { ...node.data, generating: true,
    taskIds: ['live'], requestId: 'live', submissionLocked: true, resultAssetViews: {} } }], { record: false });
  history.setNodes((nodes) => deleteCanvasNodes(nodes, ['target']));
  history.undo();
  const restored = history.getSnapshot().nodes[0];
  assert.equal(restored.data.nodeResults.batches.length, 4);
  for (const field of ['generating', 'taskIds', 'requestId', 'submissionLocked', 'resultAssetViews']) assert.equal(restored.data[field], undefined);
  history.redo();
  assert.equal(history.getSnapshot().nodes.length, 0);
  history.dispose();
  const added = createCanvasHistory();
  added.setNodes([fixture()]);
  added.setNodes(([node]) => [append(node, 2)], { record: false });
  added.undo();
  added.redo();
  assert.equal(added.getSnapshot().nodes[0].data.nodeResults.batches.length, 3);
  added.dispose();
});

test('首次结果写入后旧正文撤销不破坏投影，非法投影更新立即拒绝', () => {
  const legacy = source();
  const history = createCanvasHistory([legacy]);
  history.setNodes(([node]) => [{ ...node, data: { ...node.data, content: '改过的正文' } }]);
  history.setNodes(() => [{ ...fixture('text'), id: legacy.id }], { record: false });
  history.undo();
  assert.equal(history.getSnapshot().nodes[0].data.content, '正文0');
  assert.throws(() => history.setNodes(([node]) => [{ ...node, data: { ...node.data, content: '冲突' } }]));
  assert.equal(history.getSnapshot().nodes[0].data.content, '正文0');
  history.dispose();
});

test('空结果协议可复制和导入，纯运行更新及结果切换不清空重做栈', async () => {
  const node = fixture('text');
  node.data.nodeResults = createCanvasNodeResults();
  Object.assign(node.data, projectCanvasCurrentResult(node.data.nodeResults));
  const imported = parseCanvasFile(await serializeCanvasFile([node], '空历史'));
  assert.deepEqual(imported[0].data.nodeResults, createCanvasNodeResults());
  const history = createCanvasHistory([fixture()]);
  history.setNodes(([item]) => [{ ...item, position: { x: 100, y: 0 } }]);
  history.undo();
  history.setNodes(([item]) => [{ ...item, data: { ...item.data, generating: true, taskIds: ['live'] } }]);
  assert.equal(history.getSnapshot().canUndo, false);
  assert.equal(history.getSnapshot().canRedo, true);
  history.setNodes(([item]) => [append(item, 2)]);
  assert.equal(history.getSnapshot().canRedo, true);
  history.redo();
  assert.equal(history.getSnapshot().nodes[0].data.nodeResults.batches.length, 3);
  assert.equal(history.getSnapshot().nodes[0].data.generating, true);
  history.dispose();
});
