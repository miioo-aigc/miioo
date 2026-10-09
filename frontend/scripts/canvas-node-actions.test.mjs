import test from 'node:test';
import assert from 'node:assert/strict';
import { copyCanvasNodes, pasteCanvasNodes, deleteCanvasNodes, moveCanvasNodesOut, setCanvasGroupsStacked, getCanvasStackPresentation } from '../src/components/canvas/CanvasNodeActions.js';
import { createCanvasHistory } from '../src/components/canvas/CanvasHistory.js';
import { getCanvasGroupFocus } from '../src/components/canvas/CanvasGroupFocus.js';

test('聚焦使用组世界中心，小组不放大，大组保留边距缩小', () => {
  const group = { id: 'g', position: { x: 100, y: 200 }, style: { width: 400, height: 200 } };
  assert.deepEqual(getCanvasGroupFocus([group], group, { width: 1200, height: 800 }, 1), { x: 300, y: 300, zoom: 1 });
  assert.equal(getCanvasGroupFocus([group], group, { width: 1200, height: 800 }, 0.5).zoom, 0.5);
  const big = { ...group, style: { width: 2000, height: 1000 }, parentId: 'parent' };
  const parent = { id: 'parent', position: { x: 50, y: 70 } };
  assert.deepEqual(getCanvasGroupFocus([parent, big], big, { width: 1200, height: 800 }, 1), { x: 1150, y: 770, zoom: 0.552 });
});

const fixture = () => [
  { id: 'g', type: 'canvasGroup', selected: true, position: { x: 100, y: 100 }, style: { width: 600, height: 400 }, data: { label: '组' } },
  { id: 'a', type: 'text', parentId: 'g', position: { x: 8, y: 8 }, data: { label: '文本', content: '正文', generating: true, generationRequestId: 'request' } },
  { id: 'b', type: 'image', parentId: 'g', position: { x: 280, y: 8 }, data: { label: '图片', imageSourceIds: ['a', 'outside'] } },
  { id: 'outside', type: 'text', position: { x: 900, y: 0 }, data: { label: '外部', textSourceIds: ['a'] } },
];

test('复制组包含后代、内部连线重映射，不复制任务或外部连线', () => {
  const nodes = fixture(), clipboard = copyCanvasNodes(nodes);
  let counter = 0;
  const pasted = pasteCanvasNodes(nodes, clipboard, { x: 1000, y: 200 }, () => `${++counter}`);
  const [group, a, b] = pasted.slice(4);
  assert.deepEqual(group.position, { x: 1000, y: 200 });
  assert.equal(a.parentId, group.id);
  assert.equal(a.data.generating, undefined);
  assert.equal(a.data.generationRequestId, undefined);
  assert.deepEqual(b.data.imageSourceIds, [a.id]);
  assert.deepEqual(clipboard[2].data.imageSourceIds, ['a', 'outside']);
});

test('单独复制组内节点使用绝对坐标，原节点不变', () => {
  const nodes = fixture().map((node) => ({ ...node, selected: node.id === 'a' }));
  const [copied] = copyCanvasNodes(nodes);
  assert.equal(copied.parentId, undefined);
  assert.deepEqual(copied.position, { x: 108, y: 108 });
  copied.data.content = '新正文';
  assert.equal(nodes[1].data.content, '正文');
});

test('删除组递归删除成员、清理外部引用，并可整体撤销', () => {
  const history = createCanvasHistory(fixture());
  history.setNodes((nodes) => deleteCanvasNodes(nodes, ['g']));
  assert.equal(history.getSnapshot().nodes.length, 1);
  assert.deepEqual(history.getSnapshot().nodes[0].data.textSourceIds, []);
  history.undo();
  assert.equal(history.getSnapshot().nodes.length, 4);
  assert.deepEqual(history.getSnapshot().nodes.find((node) => node.id === 'outside').data.textSourceIds, ['a']);
  history.dispose();
});

test('移出组保持世界坐标和连线，不删除成员', () => {
  const next = moveCanvasNodesOut(fixture(), ['a']);
  const a = next.find((node) => node.id === 'a');
  assert.equal(a.parentId, undefined);
  assert.deepEqual(a.position, { x: 108, y: 108 });
  assert.deepEqual(next.find((node) => node.id === 'b').data.imageSourceIds, ['a', 'outside']);
});

test('堆叠只改变展示，隐藏内部连线并将外部连线接到组', () => {
  const nodes = fixture();
  const stacked = setCanvasGroupsStacked(nodes, ['g'], true);
  const edges = [{ id: 'inner', source: 'a', target: 'b' }, { id: 'outer', source: 'a', target: 'outside' }];
  const view = getCanvasStackPresentation(stacked, edges);
  assert.equal(view.nodes[1].hidden, true);
  assert.equal(view.nodes[0].style.width, 270);
  assert.equal(stacked[0].style.width, 600);
  assert.deepEqual(stacked[1].position, nodes[1].position);
  assert.equal(view.edges[0].hidden, true);
  assert.equal(view.edges[1].source, 'g');
  assert.equal(view.edges[1].sourceHandle, 'stack-output');
  const restored = getCanvasStackPresentation(setCanvasGroupsStacked(stacked, ['g'], false), edges);
  assert.equal(restored.nodes[1].hidden, false);
  assert.equal(restored.edges[1].source, 'a');
});

test('嵌套堆叠指向最外层可见组，删除最后成员清理空组', () => {
  const nodes = fixture();
  nodes.unshift({ id: 'outer', type: 'canvasGroup', position: { x: 0, y: 0 }, data: { stacked: true }, style: { width: 800, height: 600 } });
  nodes[1].parentId = 'outer';
  nodes[1].data.stacked = true;
  const view = getCanvasStackPresentation(nodes, [{ source: 'a', target: 'outside' }]);
  assert.equal(view.edges[0].source, 'outer');
  assert.equal(view.nodes[1].hidden, true);
  assert.deepEqual(deleteCanvasNodes(nodes, ['a', 'b']).map((node) => node.id), ['outside']);
});
