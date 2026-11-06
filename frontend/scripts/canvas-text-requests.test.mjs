import test from 'node:test';
import assert from 'node:assert/strict';
import { createCanvasTextRequests } from '../src/components/canvas/CanvasTextRequests.js';
import { createCanvasHistory } from '../src/components/canvas/CanvasHistory.js';
import { createCanvasNode } from '../src/components/canvas/canvasNodeUtils.js';
import { planCanvasTextGeneration, beginCanvasTextGeneration, applyCanvasTextResult } from '../src/components/canvas/CanvasTextGeneration.js';

test('同节点生成互斥，删除不影响其他节点，撤销后旧响应不得回填', () => {
  const a = createCanvasNode('text', undefined, 'a');
  a.data.content = '上传正文';
  const b = createCanvasNode('text', undefined, 'b');
  b.data.content = '另一个节点正文';
  const history = createCanvasHistory([a, b]);
  const requests = createCanvasTextRequests();
  const start = (id) => {
    const plan = planCanvasTextGeneration(history.getSnapshot().nodes, id, '续写', 'model');
    const controller = requests.start(plan);
    history.setNodes((nodes) => beginCanvasTextGeneration(nodes, plan));
    return { plan, controller };
  };
  const first = start('a'), other = start('b');
  assert.throws(() => start('a'), /正在/);
  assert.equal(history.getSnapshot().nodes.length, 2);
  assert.equal(first.plan.resultId, 'a');
  assert.equal(other.plan.resultId, 'b');
  history.setNodes((nodes) => nodes.filter((n) => n.id !== 'a'));
  requests.reconcile(history.getSnapshot().nodes);
  assert.deepEqual(history.getSnapshot().nodes.map((n) => n.id), ['b']);
  assert.equal(first.controller.signal.aborted, true);
  assert.equal(other.controller.signal.aborted, false);
  assert.equal(requests.size, 1);
  history.setNodes((nodes) => applyCanvasTextResult(nodes, first.plan, '删除后的迟到结果'), { record: false });
  assert.deepEqual(history.getSnapshot().nodes.map((n) => n.id), ['b']);
  history.undo();
  history.setNodes((nodes) => applyCanvasTextResult(nodes, first.plan, '撤销后的过期结果'), { record: false });
  assert.equal(history.getSnapshot().nodes.find((n) => n.id === 'a').data.content, '上传正文');
  assert.equal(history.getSnapshot().nodes.find((n) => n.id === 'a').data.generationRequestId, undefined);
  history.setNodes((nodes) => applyCanvasTextResult(nodes, other.plan, 'B结果'), { record: false });
  assert.equal(history.getSnapshot().nodes.find((n) => n.id === 'b').data.content, 'B结果');
});

test('同一个结果节点不能重复写入，取消后可重新请求', () => {
  const requests = createCanvasTextRequests();
  requests.start({ nodeId: 'a', resultId: 'a', requestId: 'one' });
  assert.throws(() => requests.start({ nodeId: 'a', resultId: 'a', requestId: 'two' }), /该节点正在创作/);
  requests.abortAll();
  requests.start({ nodeId: 'a', resultId: 'a', requestId: 'two' });
  assert.equal(requests.size, 1);
});

test('五个不同节点可并发，第六个拒绝；结束释放名额且不影响其他任务', () => {
  const requests = createCanvasTextRequests();
  const plans = Array.from({ length: 5 }, (_, i) => ({ nodeId: `r${i}`, resultId: `r${i}`, requestId: `q${i}` }));
  for (const plan of plans) requests.start(plan);
  assert.throws(() => requests.start({ nodeId: 'a', resultId: 'six' }), /最大请求数为5，请稍后再试。/);
  requests.finish('q2');
  requests.start({ nodeId: 'six', resultId: 'six', requestId: 'q6' });
  assert.equal(requests.size, 5);
});
test('删除当前节点只取消对应请求，恢复不重发', () => {
  const requests = createCanvasTextRequests();
  const b = requests.start({ nodeId: 'b', resultId: 'b', requestId: 'qb' });
  const c = requests.start({ nodeId: 'c', resultId: 'c', requestId: 'qc' });
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
