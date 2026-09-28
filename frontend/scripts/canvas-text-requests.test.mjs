import test from 'node:test';
import assert from 'node:assert/strict';
import { createCanvasTextRequests } from '../src/components/canvas/CanvasTextRequests.js';
import { createCanvasHistory } from '../src/components/canvas/CanvasHistory.js';
import { createCanvasNode } from '../src/components/canvas/canvasNodeUtils.js';
import { planCanvasTextGeneration, beginCanvasTextGeneration, applyCanvasTextResult } from '../src/components/canvas/CanvasTextGeneration.js';

test('同一素材派生B/C，删除选中的C不删A/B，撤销后旧响应不得回填', () => {
  const a = createCanvasNode('text', undefined, 'a');
  a.data.content = '上传正文';
  const history = createCanvasHistory([a]);
  const requests = createCanvasTextRequests();
  const start = (id) => {
    const plan = planCanvasTextGeneration(history.getSnapshot().nodes, 'a', '续写', 'model', id);
    requests.start(plan);
    history.setNodes((nodes) => beginCanvasTextGeneration(nodes, plan));
    return plan;
  };
  const b = start('b'), c = start('c');
  assert.equal(history.getSnapshot().nodes[0].data.generating, false);
  assert.deepEqual(history.getSnapshot().nodes.filter((n) => n.selected).map((n) => n.id), ['c']);
  history.setNodes((nodes) => nodes.filter((n) => !n.selected));
  requests.reconcile(history.getSnapshot().nodes);
  assert.deepEqual(history.getSnapshot().nodes.map((n) => n.id), ['a', 'b']);
  assert.equal(requests.size, 1);
  history.undo();
  history.setNodes((nodes) => applyCanvasTextResult(nodes, c, '过期结果'), { record: false });
  assert.equal(history.getSnapshot().nodes.find((n) => n.id === 'c').data.content, '');
  history.setNodes((nodes) => applyCanvasTextResult(nodes, b, 'B结果'), { record: false });
  assert.equal(history.getSnapshot().nodes.find((n) => n.id === 'b').data.content, 'B结果');
  assert.equal(history.getSnapshot().nodes[0].data.content, '上传正文');
});

test('同一个结果节点不能重复写入，取消后可重新请求', () => {
  const requests = createCanvasTextRequests();
  requests.start({ nodeId: 'a', resultId: 'a', requestId: 'one' });
  assert.throws(() => requests.start({ nodeId: 'a', resultId: 'a', requestId: 'two' }), /该节点正在创作/);
  requests.abortAll();
  requests.start({ nodeId: 'a', resultId: 'a', requestId: 'two' });
  assert.equal(requests.size, 1);
});

test('同源最多五个独立任务，第六个拒绝；结束释放名额且不影响其他任务', () => {
  const requests = createCanvasTextRequests();
  const plans = Array.from({ length: 5 }, (_, i) => ({ nodeId: 'a', resultId: `r${i}`, requestId: `q${i}` }));
  for (const plan of plans) requests.start(plan);
  assert.throws(() => requests.start({ nodeId: 'a', resultId: 'six' }), /最大请求数为5，请稍后再试。/);
  requests.finish('q2');
  requests.start({ nodeId: 'a', resultId: 'six', requestId: 'q6' });
  assert.equal(requests.size, 5);
});
test('删除结果只取消该任务，删除素材不取消快照任务，恢复不重发', () => {
  const requests = createCanvasTextRequests();
  const b = requests.start({ nodeId: 'a', resultId: 'b', requestId: 'qb' });
  const c = requests.start({ nodeId: 'a', resultId: 'c', requestId: 'qc' });
  requests.reconcile([{ id: 'b', data: { generationRequestId: 'qb' } }, { id: 'c', data: { generationRequestId: 'qc' } }]);
  assert.equal(b.signal.aborted, false);
  requests.reconcile([{ id: 'c', data: { generationRequestId: 'qc' } }]);
  assert.equal(b.signal.aborted, true);
  assert.equal(c.signal.aborted, false);
  requests.reconcile([{ id: 'b', data: {} }, { id: 'c', data: { generationRequestId: 'qc' } }]);
  assert.equal(requests.size, 1);
  requests.abortAll();
  assert.equal(c.signal.aborted, true);
});
