import test from 'node:test';
import assert from 'node:assert/strict';
import { moveCanvasNodesInto } from '../src/components/canvas/CanvasGroupTransfer.js';
import { fitCanvasGroups, getCanvasAbsolutePosition } from '../src/components/canvas/CanvasGroups.js';
const member = (id, parentId, x, y) => ({ id, parentId, type: 'image', position: { x, y }, measured: { width: 240, height: 264 }, data: {} });
for (const offset of [{ x: 600, y: 400 }, { x: -400, y: -300 }, { x: 0, y: 0 }]) {
  test(`移入堆叠组包含实际卡片和标题，偏移${JSON.stringify(offset)}`, () => {
    const nodes = [
      { id: 'target', type: 'canvasGroup', position: { x: 0, y: 0 }, style: { width: 280, height: 600 }, data: {} },
      member('a', 'target', 20, 20), member('b', 'target', 20, 316),
      { id: 'stack', type: 'canvasGroup', position: { x: 400, y: 100 }, style: { width: 280, height: 600 }, data: { stacked: true, stackOffset: offset } },
      member('c', 'stack', 20, 20), member('d', 'stack', 20, 316),
    ];
    const before = getCanvasAbsolutePosition(nodes, nodes[3]);
    const next = moveCanvasNodesInto(nodes, ['stack'], 'target');
    const stack = next.find((n) => n.id === 'stack');
    const target = next.find((n) => n.id === 'target');
    const absolute = getCanvasAbsolutePosition(next, stack);
    assert.equal(absolute.x + stack.data.stackOffset.x, before.x + offset.x);
    assert.equal(absolute.y + stack.data.stackOffset.y, before.y + offset.y);
    const x = stack.position.x + stack.data.stackOffset.x;
    const y = stack.position.y + stack.data.stackOffset.y;
    assert.ok(x >= 20 && y - 24 >= 20);
    assert.ok(x + 312 + 20 <= target.style.width);
    assert.ok(y + 312 + 20 <= target.style.height);
    assert.deepEqual(fitCanvasGroups(next), next);
    for (const id of ['a', 'b', 'c', 'd']) assert.deepEqual(getCanvasAbsolutePosition(next, next.find((n) => n.id === id)), getCanvasAbsolutePosition(nodes, nodes.find((n) => n.id === id)));
  });
}
