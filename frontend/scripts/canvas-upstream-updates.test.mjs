import test from 'node:test';
import assert from 'node:assert/strict';
import { getCanvasUpstreamUpdates } from '../src/components/canvas/CanvasUpstreamUpdates.js';

const sources = ['a', 'b'].map(id => ({ id, data: { content: '新内容' } }));
const target = { id: 'target', data: { nodeResults: { batches: [{ completedAt: 1,
  snapshot: { inputs: sources.map(source => ({ nodeId: source.id, content: '旧内容' })) },
}] } } };
const nodes = [...sources, target];
const edge = source => ({ source, target: 'target' });

test('断开唯一变化的上游后，节点和提示标识均清除；重新连接恢复提示', () => {
  assert.equal(getCanvasUpstreamUpdates(nodes, [edge('a')]).upstreamUpdatedIds.has('target'), true);
  const disconnected = getCanvasUpstreamUpdates(nodes, []);
  assert.equal(disconnected.upstreamUpdatedIds.size, 0);
  assert.equal(disconnected.upstreamUpdateKeys.size, 0);
  assert.equal(getCanvasUpstreamUpdates(nodes, [edge('a')]).upstreamUpdatedIds.has('target'), true);
});

test('断开一个上游后，仍连接的变化上游继续提醒', () => {
  const remaining = getCanvasUpstreamUpdates(nodes, [edge('b')]);
  assert.equal(remaining.upstreamUpdatedIds.has('target'), true);
  assert.equal(remaining.upstreamUpdateKeys.get('target'), JSON.stringify(['b', undefined, null, '新内容']));
});

test('剩余连接与快照一致时，不因已断开的变化上游提醒', () => {
  const unchanged = [sources[0], { id: 'b', data: { content: '旧内容' } }, target];
  assert.equal(getCanvasUpstreamUpdates(unchanged, [edge('b')]).upstreamUpdatedIds.size, 0);
});
