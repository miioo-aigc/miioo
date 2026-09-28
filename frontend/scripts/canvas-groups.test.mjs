import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { addCanvasReference } from '../src/components/canvas/CanvasReferences.js';

import * as groups from '../src/components/canvas/CanvasGroups.js';
const node = (id, x, y, selected = true) => ({ id, type: 'image', position: { x, y }, measured: { width: 240, height: 264 }, selected, data: { creationPanelOpen: true } });

test('组内成员不再依赖双击解锁，点击身份不提升为父组', () => {
  const hook = readFileSync(new URL('../src/components/canvas/UseCanvasGrouping.js', import.meta.url), 'utf8');
  assert.doesNotMatch(hook, /editingGroupId|draggable: false/);
  assert.match(hook, /selectable: true/);
  assert.match(hook, /resolveSelectionId: \(node\) => node.id/);
});

test('直接拖动组内成员后只移动该成员，释放后保持8px边距', () => {
  const initial = groups.groupCanvasNodes([node('a', 100, 200), node('b', 400, 300)], 'g');
  const selected = groups.setCanvasSelection(initial, ['a']);
  assert.equal(selected[0].selected, false);
  const moving = selected.map((item) => item.id === 'a' ? { ...item, dragging: true, position: { x: -40, y: -30 } } : item);
  const during = groups.fitCanvasGroups(moving);
  assert.deepEqual(during[0].position, initial[0].position);
  const released = groups.fitCanvasGroups(during.map((item) => ({ ...item, dragging: false })));
  assert.deepEqual(groups.getCanvasAbsolutePosition(released, released[1]), { x: 52, y: 162 });
  assert.deepEqual(groups.getCanvasAbsolutePosition(released, released[2]), { x: 400, y: 300 });
  assert.deepEqual(released[1].position, { x: 8, y: 8 });
});

test('分组保留世界坐标，四边为8px，父节点在成员之前', () => {
  assert.equal(typeof groups.groupCanvasNodes, 'function');
  const original = [node('a', 100, 200), node('b', 400, 300)];
  const result = groups.groupCanvasNodes(original, 'g');
  assert.deepEqual(result[0].position, { x: 92, y: 192 });
  assert.deepEqual(result[0].style, { width: 556, height: 380 });
  assert.equal(result[0].data.label, '组合1');
  assert.equal(result[0].selected, true);
  for (const child of result.slice(1)) {
    assert.equal(child.parentId, 'g');
    assert.equal(child.selected, false);
    assert.equal(child.data.creationPanelOpen, false);
    assert.deepEqual(groups.getCanvasAbsolutePosition(result, child), original.find((item) => item.id === child.id).position);
  }
});

test('不足两个节点不分组', () => {
  assert.equal(typeof groups.groupCanvasNodes, 'function');
  const single = [node('a', 0, 0)];
  assert.equal(groups.groupCanvasNodes(single, 'g'), single);
});

test('跨组抽出成员，旧组剩一个自动解组，世界坐标保持', () => {
  const original = [...groups.groupCanvasNodes([node('a', 100, 200), node('b', 400, 300)], 'old'), node('c', 900, 500)];
  const result = groups.groupCanvasNodes(groups.setCanvasSelection(original, ['a', 'c']), 'new');
  assert.ok(!result.some((item) => item.id === 'old'));
  assert.equal(result.find((item) => item.id === 'b').parentId, undefined);
  for (const id of ['a', 'b', 'c']) {
    assert.deepEqual(groups.getCanvasAbsolutePosition(result, result.find((item) => item.id === id)), groups.getCanvasAbsolutePosition(original, original.find((item) => item.id === id)));
  }
  assert.equal(result.find((item) => item.id === 'a').parentId, 'new');
});

test('全选成员重新打组替换旧组，选中组框则保留子组', () => {
  const original = groups.groupCanvasNodes([node('a', 100, 200), node('b', 400, 300)], 'old');
  const replaced = groups.groupCanvasNodes(groups.setCanvasSelection(original, ['a', 'b']), 'new');
  assert.ok(!replaced.some((item) => item.id === 'old'));
  assert.equal(replaced.find((item) => item.id === 'new').parentId, undefined);
  const nested = groups.groupCanvasNodes([...original, node('c', 900, 500)], 'new');
  assert.equal(nested.find((item) => item.id === 'old').parentId, 'new');
  const released = groups.ungroupCanvasNodes(nested);
  assert.equal(released.find((item) => item.id === 'old').parentId, undefined);
  assert.equal(released.find((item) => item.id === 'a').parentId, 'old');
  assert.ok(!released.some((item) => item.id === 'new'));
  assert.equal(groups.ungroupCanvasNodes(groups.setCanvasSelection(original, ['a'])).length, original.length);
});

test('Shift 多选及解组快捷键接线', () => {
  const page = readFileSync(new URL('../src/pages/CanvasPage.jsx', import.meta.url), 'utf8');
  const hook = readFileSync(new URL('../src/components/canvas/UseCanvasGrouping.js', import.meta.url), 'utf8');
  assert.match(page, /multiSelectionKeyCode=\{\['Meta', 'Control', 'Shift'\]\}/);
  assert.match(page, /event.metaKey \|\| event.ctrlKey \|\| event.shiftKey/);
  assert.match(hook, /ungroupCanvasNodes\(current\)/);
});

test('跨组抽出后保留两个成员的旧组，所有父节点在子节点之前', () => {
  const original = [...groups.groupCanvasNodes([node('a', 100, 200), node('b', 400, 300), node('c', 800, 500)], 'old'), node('d', 1200, 600)];
  const result = groups.groupCanvasNodes(groups.setCanvasSelection(original, ['a', 'd']), 'new');
  assert.equal(result.filter((item) => item.parentId === 'old').length, 2);
  for (const item of result) {
    if (item.parentId) assert.ok(result.findIndex((parent) => parent.id === item.parentId) < result.indexOf(item));
    if (item.type !== 'canvasGroup') assert.deepEqual(groups.getCanvasAbsolutePosition(result, item), groups.getCanvasAbsolutePosition(original, original.find((before) => before.id === item.id)));
  }
});

test('选中祖先组与后代卡片时不拆出后代；嵌套解组保留世界坐标', () => {
  const inner = groups.groupCanvasNodes([node('a', 100, 200), node('b', 400, 300)], 'inner');
  const outer = groups.groupCanvasNodes([...inner, node('c', 800, 500)], 'outer');
  const result = groups.groupCanvasNodes(groups.setCanvasSelection([...outer, node('d', 1200, 600)], ['outer', 'a', 'd']), 'new');
  assert.equal(result.find((item) => item.id === 'a').parentId, 'inner');
  const released = groups.ungroupCanvasNodes(groups.setCanvasSelection(result, ['inner']));
  assert.equal(released.find((item) => item.id === 'a').parentId, 'outer');
  assert.deepEqual(groups.getCanvasAbsolutePosition(released, released.find((item) => item.id === 'a')), { x: 100, y: 200 });
});

test('支持组合再次打组，并递增名称', () => {
  assert.equal(typeof groups.groupCanvasNodes, 'function');
  const first = groups.groupCanvasNodes([node('a', 0, 0), node('b', 300, 0)], 'g1');
  const result = groups.groupCanvasNodes([...first, node('c', 700, 0)], 'g2');
  assert.equal(result[0].data.label, '组合2');
  assert.equal(result.find((item) => item.id === 'g1').parentId, 'g2');
  assert.deepEqual(groups.getCanvasAbsolutePosition(result, result.find((item) => item.id === 'a')), { x: 0, y: 0 });
});

test('成员移动或尺寸改变后重新贴合边界，其他成员世界坐标不变', () => {
  assert.equal(typeof groups.fitCanvasGroups, 'function');
  const original = groups.groupCanvasNodes([node('a', 100, 200), node('b', 400, 300)], 'g');
  const changed = original.map((item) => item.id === 'a' ? { ...item, position: { x: -50, y: -20 } } : item);
  const before = groups.getCanvasAbsolutePosition(changed, changed[2]);
  const fitted = groups.fitCanvasGroups(changed);
  assert.deepEqual(fitted[1].position, { x: 8, y: 8 });
  assert.deepEqual(groups.getCanvasAbsolutePosition(fitted, fitted[2]), before);
});

test('多选收起所有创作面板；单选可以打开面板', () => {
  assert.equal(typeof groups.setCanvasSelection, 'function');
  const nodes = [node('a', 0, 0), node('b', 300, 0)];
  assert.ok(groups.setCanvasSelection(nodes, ['a', 'b'], true).every((item) => !item.data.creationPanelOpen));
  assert.equal(groups.setCanvasSelection(nodes, ['a'], true)[0].data.creationPanelOpen, true);
});

test('组内添加参考图使用世界坐标而不是成员相对坐标', () => {
  const nodes = groups.groupCanvasNodes([node('a', 1000, 200), node('b', 1400, 200)], 'g');
  const result = addCanvasReference(nodes, 'a', { url: 'https://example.com/image.png', asset_type: 'image', name: '参考' });
  assert.deepEqual(result.at(-1).position, { x: 680, y: 200 });
});
