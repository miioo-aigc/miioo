import test from 'node:test';
import assert from 'node:assert/strict';
import { copyCanvasNodes, pasteCanvasNodes, deleteCanvasNodes, hasCanvasDeletionTasks, moveCanvasNodesOut, setCanvasGroupsStacked, getCanvasStackPresentation } from '../src/components/canvas/CanvasNodeActions.js';
import { createCanvasHistory } from '../src/components/canvas/CanvasHistory.js';
import { getCanvasGroupFocus } from '../src/components/canvas/CanvasGroupFocus.js';
import { duplicateCanvasNodes } from '../src/components/canvas/CanvasNodeActions.js';
import { getCanvasAbsolutePosition } from '../src/components/canvas/CanvasGroups.js';

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

test('组内节点副本保留父组、偏移32并扩展边界，可单步撤销重做', () => {
  const nodes = fixture().map((node) => ({ ...node, selected: node.id === 'b' }));
  const before = structuredClone(nodes);
  const history = createCanvasHistory(nodes);
  history.setNodes((current) => duplicateCanvasNodes(current, () => 'copy'));
  const result = history.getSnapshot().nodes;
  const copy = result.at(-1);
  assert.equal(copy.parentId, 'g');
  assert.equal(copy.selected, true);
  assert.deepEqual(getCanvasAbsolutePosition(result, copy), { x: 412, y: 140 });
  assert.deepEqual(getCanvasAbsolutePosition(result, result[2]), { x: 380, y: 108 });
  assert.ok(result[0].style.width >= copy.position.x + 240 + 8);
  assert.deepEqual(nodes, before);
  history.undo();
  assert.equal(history.getSnapshot().nodes.length, nodes.length);
  history.redo();
  assert.equal(history.getSnapshot().nodes.at(-1).parentId, 'g');
  history.dispose();
});

test('嵌套折叠组副本留在父组，内部层级、尺寸、折叠偏移和引用保留', () => {
  const nodes = fixture();
  nodes[0].parentId = 'outer';
  nodes[0].data = { ...nodes[0].data, stacked: true, stackOffset: { x: 40, y: 60 } };
  nodes.unshift({ id: 'outer', type: 'canvasGroup', position: { x: 1000, y: 2000 }, style: { width: 900, height: 800 }, data: {} });
  let sequence = 0;
  const result = duplicateCanvasNodes(nodes, () => String(++sequence));
  const [group, a, b] = result.slice(nodes.length);
  assert.equal(group.parentId, 'outer');
  assert.deepEqual(group.style, nodes[1].style);
  assert.equal(group.data.stacked, true);
  assert.deepEqual(group.data.stackOffset, { x: 40, y: 60 });
  assert.deepEqual(getCanvasAbsolutePosition(result, group), { x: 1132, y: 2132 });
  assert.equal(a.parentId, group.id);
  assert.deepEqual(a.position, nodes[2].position);
  assert.deepEqual(b.data.imageSourceIds, [a.id]);
  assert.equal(a.data.generating, undefined);
  assert.deepEqual(result.filter((node) => node.selected).map((node) => node.id), [group.id]);
});

test('跨组多选副本分别保留父组；普通复制粘贴仍脱离原组按落点放置', () => {
  const nodes = fixture().map((node) => ({ ...node, selected: ['a', 'outside'].includes(node.id) }));
  let sequence = 0;
  const result = duplicateCanvasNodes(nodes, () => String(++sequence));
  assert.equal(result.at(-2).parentId, 'g');
  assert.equal(result.at(-1).parentId, undefined);
  assert.deepEqual(result.at(-1).position, { x: 932, y: 32 });
  const pasted = pasteCanvasNodes(nodes, copyCanvasNodes(nodes), { x: -300, y: -400 });
  assert.equal(pasted.at(-2).parentId, undefined);
  assert.deepEqual(pasted.at(-2).position, { x: -300, y: -292 });
});

test('清空覆盖未选中节点和组，单步撤销恢复布局与内部引用，重做再次清空', () => {
  const nodes = fixture();
  nodes[1].data = { label: '文本', content: '保留正文' };
  const clipboard = copyCanvasNodes(nodes);
  const history = createCanvasHistory(nodes);
  history.setNodes((current) => deleteCanvasNodes(current, current.map((node) => node.id)));
  assert.deepEqual(history.getSnapshot().nodes, []);
  history.undo();
  const restored = history.getSnapshot().nodes;
  assert.deepEqual(restored.map((node) => node.id), nodes.map((node) => node.id));
  assert.deepEqual(restored[2].data.imageSourceIds, ['a', 'outside']);
  assert.deepEqual(restored[1].position, nodes[1].position);
  history.redo();
  assert.deepEqual(history.getSnapshot().nodes, []);
  const pasted = pasteCanvasNodes([], clipboard, { x: -200, y: 350 });
  assert.deepEqual(pasted.find((node) => !node.parentId).position, { x: -200, y: 350 });
  history.dispose();
});

test('四类普通节点不论有无内容均免确认，运行和排队需要确认', () => {
  for (const type of ['text', 'image', 'video', 'audio']) {
    for (const data of [{}, { content: '正文' }, { prompt: '提示词' }, { asset: { url: '/media' } }]) {
      assert.equal(hasCanvasDeletionTasks([{ id: 'a', type, data }], ['a']), false);
    }
    for (const data of [{ generating: true }, { generationPending: true }]) {
      assert.equal(hasCanvasDeletionTasks([{ id: 'a', type, data }], ['a']), true);
    }
  }
});

test('批量和嵌套组检查任务后代，组外运行任务不影响删除', () => {
  const nodes = fixture();
  assert.equal(hasCanvasDeletionTasks(nodes, ['g']), true);
  assert.equal(hasCanvasDeletionTasks(nodes, ['b', 'outside']), false);
  nodes.push({ id: 'inner', parentId: 'g', type: 'canvasGroup', data: {} });
  nodes[1].parentId = 'inner';
  nodes[1].data = { generationPending: true };
  assert.equal(hasCanvasDeletionTasks(nodes, ['g']), true);
  nodes[1].data = {};
  assert.equal(hasCanvasDeletionTasks(nodes, ['g']), false);
});

test('删除撤销令牌随历史变化，异步非历史更新不使其失效', () => {
  const history = createCanvasHistory(fixture());
  history.setNodes((nodes) => deleteCanvasNodes(nodes, ['a']));
  const token = history.getUndoToken();
  assert.ok(token);
  history.setNodes((nodes) => nodes.map((node) => ({ ...node, selected: true })), { record: false });
  assert.equal(history.getUndoToken(), token);
  history.undo();
  assert.notEqual(history.getUndoToken(), token);
  assert.ok(history.getSnapshot().nodes.some((node) => node.id === 'a'));
  history.dispose();
});

test('删除已连接的空节点会清理下游引用，不修改原始快照', () => {
  const nodes = fixture();
  nodes[1].data = { label: '空节点', prompt: '' };
  nodes[2].data.imageSourceIds = ['a'];
  assert.equal(hasCanvasDeletionTasks(nodes, ['a']), false);
  const result = deleteCanvasNodes(nodes, ['a']);
  assert.equal(result.some((node) => node.id === 'a'), false);
  assert.deepEqual(result.find((node) => node.id === 'b').data.imageSourceIds, []);
  assert.deepEqual(result.find((node) => node.id === 'outside').data.textSourceIds, []);
  assert.deepEqual(nodes[2].data.imageSourceIds, ['a']);
});

test('形变预览使用组内相对位置、卡片高度及嵌套世界坐标，不改写成员', () => {
  const nodes = fixture();
  nodes.push({ id: 'inner', type: 'canvasGroup', parentId: 'g', position: { x: 40, y: 60 }, data: {} });
  nodes[1].parentId = 'inner';
  nodes[1].measured = { width: 240, height: 344 };
  const before = structuredClone(nodes);
  const member = getCanvasStackPresentation(nodes, []).nodes[0].data.stackMembers.find((item) => item.id === 'a');
  assert.deepEqual({ x: member.x, y: member.y, width: member.width, height: member.height }, { x: 48, y: 92, width: 240, height: 320 });
  assert.deepEqual(nodes, before);
});

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
  assert.equal(view.nodes[0].style.width, 312);
  assert.equal(view.nodes[0].style.height, 312);
  assert.deepEqual(view.nodes[0].measured, { width: 312, height: 312 });
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
