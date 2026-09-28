import test from 'node:test';
import assert from 'node:assert/strict';
import { createCanvasHistory } from '../src/components/canvas/CanvasHistory.js';
import { createCanvasNode } from '../src/components/canvas/canvasNodeUtils.js';

const node = (id) => createCanvasNode('text', { x: 0, y: 0 }, id);
test('历史最多20步，撤销后新编辑清空重做；选择不占历史', () => {
  const history = createCanvasHistory();
  for (let i = 0; i < 22; i++) history.setNodes((nodes) => [...nodes, node(String(i))]);
  history.setNodes((nodes) => nodes.map((n) => ({ ...n, selected: false })));
  for (let i = 0; i < 20; i++) history.undo();
  assert.equal(history.getSnapshot().nodes.length, 2);
  assert.equal(history.getSnapshot().canUndo, false);
  history.redo();
  assert.equal(history.getSnapshot().nodes.length, 3);
  history.setNodes((nodes) => [...nodes, node('new')]);
  assert.equal(history.getSnapshot().canRedo, false);
});
test('一次拖动一条历史，恢复节点不恢复请求和输入框', () => {
  const history = createCanvasHistory([node('a')]);
  history.begin();
  for (let x = 1; x <= 10; x++) history.setNodes((nodes) => nodes.map((n) => ({ ...n, position: { x, y: 0 } })));
  history.end();
  history.undo();
  assert.equal(history.getSnapshot().nodes[0].position.x, 0);
  assert.equal(history.getSnapshot().canUndo, false);
  history.setNodes((nodes) => [...nodes, { ...node('b'), data: { content: '', textSourceIds: ['a'], generating: true, generationRequestId: 'request' } }]);
  history.setNodes((nodes) => nodes.filter((n) => n.id !== 'b'));
  history.undo();
  const restored = history.getSnapshot().nodes.find((n) => n.id === 'b');
  assert.deepEqual(restored.data.textSourceIds, ['a']);
  assert.equal(Boolean(restored.data.generating), false);
  assert.equal(Boolean(restored.data.creationPanelOpen), false);
  assert.equal(restored.data.generationRequestId, undefined);
});
test('撤销位置不丢失异步正文，连续文字输入合并，重做恢复已生成结果', () => {
  const history = createCanvasHistory([node('a')]);
  history.setNodes((nodes) => nodes.map((n) => ({ ...n, position: { x: 20, y: 0 } })));
  history.setNodes((nodes) => nodes.map((n) => ({ ...n, data: { ...n.data, content: '结果' } })), { record: false });
  history.undo();
  assert.equal(history.getSnapshot().nodes[0].data.content, '结果');
  history.setNodes((nodes) => [...nodes, node('b')]);
  history.setNodes((nodes) => nodes.map((n) => n.id === 'b' ? { ...n, data: { ...n.data, content: '生成正文' } } : n), { record: false });
  history.undo();
  history.redo();
  assert.equal(history.getSnapshot().nodes.find((n) => n.id === 'b').data.content, '生成正文');
  for (const prompt of ['一', '一二', '一二三']) history.setNodes((nodes) => nodes.map((n) => n.id === 'a' ? { ...n, data: { ...n.data, prompt } } : n));
  history.undo();
  assert.equal(history.getSnapshot().nodes[0].data.prompt, '');
});

test('撤销删除保留节点回调和素材地址，历史释放后回收地址', () => {
  const original = URL.revokeObjectURL;
  const revoked = [];
  URL.revokeObjectURL = (url) => revoked.push(url);
  try {
    const history = createCanvasHistory();
    const onAssetChange = () => {};
    const media = { ...node('media'), data: { asset: { url: 'blob:canvas-test' }, onAssetChange } };
    history.setNodes([media]);
    history.setNodes([]);
    assert.deepEqual(revoked, []);
    history.undo();
    assert.equal(history.getSnapshot().nodes[0].data.onAssetChange, onAssetChange);
    history.redo();
    for (let i = 0; i < 21; i++) history.setNodes((nodes) => [...nodes, node(String(i))]);
    assert.deepEqual(revoked, ['blob:canvas-test']);
  } finally { URL.revokeObjectURL = original; }
});
