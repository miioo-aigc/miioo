import test from 'node:test';
import assert from 'node:assert/strict';
import { getCanvasNodeNavigator } from '../src/components/canvas/CanvasNodeNavigatorData.js';

const nodes = [
  { id: 'group', type: 'canvasGroup', position: { x: 0, y: 0 }, data: { label: '角色' } },
  { id: 'nested', parentId: 'group', type: 'canvasGroup', position: { x: 20, y: 20 }, data: { label: '主角' } },
  { id: 'image', parentId: 'nested', type: 'image', position: { x: 0, y: 0 }, data: { label: '林默定妆' } },
  { id: 'text', parentId: 'group', type: 'text', position: { x: 0, y: 0 }, data: { label: '人物小传' } },
  { id: 'video', type: 'video', position: { x: 0, y: 0 }, data: { label: '预告片' } },
  { id: 'orphan', parentId: 'missing', type: 'audio', position: { x: 0, y: 0 }, data: { label: '环境声' } },
  { id: 'empty', type: 'canvasGroup', position: { x: 0, y: 0 }, data: { label: '空分组' } },
];

test('按真实 parentId 构建嵌套分组，顶层和孤儿节点进入未分组区域', () => {
  const result = getCanvasNodeNavigator(nodes);
  assert.equal(result.count, 7);
  assert.deepEqual(result.groups.map((group) => group.id), ['group', 'empty']);
  assert.deepEqual(result.groups[0].childNodes.map((item) => item.node.id), ['text']);
  assert.deepEqual(result.groups[0].childGroups[0].childNodes.map((item) => item.node.id), ['image']);
  assert.deepEqual(result.ungrouped.map((item) => item.node.id), ['video', 'orphan']);
});

test('搜索命中后代时保留祖先分组，并只展示匹配节点', () => {
  const result = getCanvasNodeNavigator(nodes, '林默', 'all');
  assert.equal(result.count, 1);
  assert.equal(result.groups[0].id, 'group');
  assert.equal(result.groups[0].matching, false);
  assert.equal(result.groups[0].childNodes.length, 0);
  assert.equal(result.groups[0].childGroups[0].id, 'nested');
  assert.equal(result.groups[0].childGroups[0].childNodes[0].node.id, 'image');
  assert.equal(result.groups.length, 1);
});

test('类型筛选隐藏不匹配节点和没有结果的分组', () => {
  const result = getCanvasNodeNavigator(nodes, '', 'image');
  assert.equal(result.count, 1);
  assert.equal(result.groups.length, 1);
  assert.equal(result.groups[0].id, 'group');
  assert.equal(result.groups[0].childGroups[0].childNodes[0].node.id, 'image');
  assert.deepEqual(result.ungrouped, []);
});

test('分组筛选保留匹配的祖先关系，搜索可以同时约束名称与类型', () => {
  const result = getCanvasNodeNavigator(nodes, '主角', 'canvasGroup');
  assert.equal(result.count, 1);
  assert.equal(result.groups[0].id, 'group');
  assert.equal(result.groups[0].childGroups[0].id, 'nested');
  assert.equal(result.groups[0].childGroups[0].childGroups.length, 0);
  assert.equal(getCanvasNodeNavigator(nodes, '不存在的节点', 'all').count, 0);
});
