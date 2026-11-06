import test from 'node:test';
import assert from 'node:assert/strict';
import { guardCanvasNodeChanges, guardCanvasNodeUpdate, guardCanvasSystemUpdate, getCanvasOperationLocks, getCanvasNodeSourceIds } from '../src/components/canvas/CanvasOperationGuards.js';

const nodes = [
  { id: 'up', type: 'text', position: { x: 0, y: 0 }, data: { content: 'a' } },
  { id: 'run', type: 'image', position: { x: 1, y: 1 }, data: { submissionLocked: true, executionSourceIds: ['up'], prompt: 'p' } },
  { id: 'other', type: 'text', position: { x: 2, y: 2 }, data: { content: 'free' } },
];

test('提交锁只保护执行节点及其直接上游，不锁其他节点', () => {
  const locks = getCanvasOperationLocks(nodes);
  assert.equal(locks.submissionLocked.has('run'), true);
  assert.equal(locks.upstreamProtected.has('up'), true);
  assert.equal(locks.upstreamProtected.has('other'), false);
  const changed = nodes.map((node) => node.id === 'other' ? { ...node, data: { ...node.data, content: 'changed' } } : node);
  assert.equal(guardCanvasNodeUpdate(nodes, changed), changed);
});

test('执行节点允许删除，上游输出和删除被拒绝', () => {
  assert.equal(guardCanvasNodeUpdate(nodes, nodes.filter((node) => node.id !== 'run')).length, 2);
  assert.equal(guardCanvasNodeUpdate(nodes, nodes.filter((node) => node.id !== 'up')), nodes);
});

test('提交节点拒绝操作、上游仍可移动和编辑下次草稿，系统新增不复活节点', () => {
  const changes = guardCanvasNodeChanges(nodes, [
    { id: 'up', type: 'remove' }, { id: 'up', type: 'position', position: { x: 5, y: 5 } },
    { id: 'run', type: 'select', selected: true }, { id: 'run', type: 'dimensions', dimensions: { width: 10, height: 10 } },
  ]);
  assert.deepEqual(changes.map((item) => item.type), ['position', 'select', 'dimensions']);
  const movedUpstream = nodes.map((node) => node.id === 'up' ? { ...node, position: { x: 8, y: 8 }, data: { ...node.data, prompt: 'next' } } : node);
  assert.equal(guardCanvasNodeUpdate(nodes, movedUpstream), movedUpstream);
  const changedLine = nodes.map((node) => node.id === 'run' ? { ...node, data: { ...node.data, prompt: 'next run' } } : node);
  assert.equal(guardCanvasNodeUpdate(nodes, changedLine), nodes);
  const changedOutgoing = nodes.map((node) => node.id === 'other' ? { ...node, data: { ...node.data, textSourceIds: ['run'] } } : node);
  assert.equal(guardCanvasNodeUpdate(nodes, changedOutgoing), nodes);
  assert.deepEqual(getCanvasNodeSourceIds({ id: 'run', data: { executionSourceIds: ['old'], textSourceIds: [] } }), []);
  const newlyConnected = [...nodes, { id: 'new-target', type: 'video', data: { textSourceIds: ['run'] } }];
  assert.equal(guardCanvasNodeUpdate(nodes, newlyConnected), nodes);
  const removable = [nodes[1], { id: 'free-target', type: 'video', data: { textSourceIds: ['run'] } }];
  assert.equal(guardCanvasNodeUpdate(removable, [{ id: 'free-target', type: 'video', data: { textSourceIds: [] } }]).length, 1);
  const alsoProtected = [...removable, { id: 'other-run', type: 'audio', data: { submissionLocked: true, executionSourceIds: ['run'] } }];
  assert.equal(guardCanvasNodeUpdate(alsoProtected, [{ ...alsoProtected[1], data: { textSourceIds: [] } }, alsoProtected[2]]), alsoProtected);
  const revived = [...nodes, { id: 'late', type: 'text', position: { x: 0, y: 0 }, data: {} }];
  assert.equal(guardCanvasNodeUpdate(nodes, revived), revived);
  assert.equal(guardCanvasSystemUpdate(nodes, revived), nodes);
  assert.equal(guardCanvasSystemUpdate(nodes, nodes.map((node) => node.id === 'run'
    ? { ...node, data: { ...node.data, generating: false, submissionLocked: false } } : node))[1].data.generating, false);
  assert.equal(guardCanvasNodeUpdate([], revived, { origin: 'load' }), revived);
});
