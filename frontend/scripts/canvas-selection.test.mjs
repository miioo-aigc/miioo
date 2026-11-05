import test from 'node:test';
import assert from 'node:assert/strict';
import { changeCanvasSelection, canvasSelectionMode } from '../src/components/canvas/CanvasSelection.js';

const fixture = () => ['a', 'middle', 'b'].map((id, index) => ({ id, position: { x: index * 300, y: 0 }, selected: id === 'a', data: { creationPanelOpen: id === 'a' } }));
const ids = (nodes) => nodes.filter((node) => node.selected).map((node) => node.id);

test('Shift加选是幂等的，范围内未点击的卡片不参与选择', () => {
  const original = fixture();
  const next = changeCanvasSelection(original, 'b', canvasSelectionMode({ shiftKey: true }));
  assert.deepEqual(ids(next), ['a', 'b']);
  assert.deepEqual(ids(changeCanvasSelection(next, 'a', 'add')), ['a', 'b']);
  assert.deepEqual(ids(original), ['a']);
  assert.ok(next.every((node) => !node.data.creationPanelOpen));
});

test('Ctrl和Command仅减选，未选卡片不会被加入，支持减到单选或空选', () => {
  for (const key of ['ctrlKey', 'metaKey']) {
    const mode = canvasSelectionMode({ [key]: true });
    const multi = changeCanvasSelection(fixture(), 'b', 'add');
    assert.deepEqual(ids(changeCanvasSelection(multi, 'middle', mode)), ['a', 'b']);
    const single = changeCanvasSelection(multi, 'a', mode);
    assert.deepEqual(ids(single), ['b']);
    assert.deepEqual(ids(changeCanvasSelection(single, 'b', mode)), []);
  }
});

test('减选优先于加选，普通点击及无效目标不修改选择', () => {
  assert.equal(canvasSelectionMode({ shiftKey: true, metaKey: true }), 'remove');
  assert.equal(canvasSelectionMode({}), null);
  const nodes = fixture();
  assert.equal(changeCanvasSelection(nodes, 'a', null), nodes);
  assert.equal(changeCanvasSelection(nodes, 'missing', 'add'), nodes);
});
