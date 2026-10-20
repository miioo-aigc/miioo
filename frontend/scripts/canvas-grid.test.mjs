import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Background, ReactFlowProvider } from '@xyflow/react';
import { CANVAS_GRID_GAP, CANVAS_GRID_DOT_SIZE, CANVAS_GRID_OFFSET } from '../src/components/canvas/CanvasGrid.js';
import { snapCanvasNodes, getSnapBox } from '../src/components/canvas/CanvasSnapping.js';

for (const zoom of [0.5, 1, 1.75]) {
  test(`缩放${zoom}时正文左上边框对齐实际背景圆点中心`, () => {
    const viewport = { x: -53, y: 27, zoom };
    const html = renderToStaticMarkup(createElement(ReactFlowProvider, null,
      createElement(Background, { variant: 'dots', gap: CANVAS_GRID_GAP,
        size: CANVAS_GRID_DOT_SIZE, offset: CANVAS_GRID_OFFSET })));
    const pattern = html.match(/<pattern\b[^>]*>/)[0];
    const circle = html.match(/<circle\b[^>]*>/)[0];
    const attr = (element, name) => Number(element.match(new RegExp(` ${name}="([^"]+)"`))[1]);
    const shift = pattern.match(/translate\(([^,]+),([^\)]+)\)/).slice(1).map(Number);
    for (const position of [{ x: 19, y: 19 }, { x: -301, y: -177 }]) {
      const node = { id: 'a', type: 'image', position, measured: { width: 317, height: 600 } };
      const frames = new Map([['a', { x: 0, y: 24, width: 317, height: 183 }]]);
      const result = snapCanvasNodes([node], ['a'], zoom, {}, frames);
      const box = getSnapBox(result.nodes, result.nodes[0], frames);
      for (const [index, axis] of ['x', 'y'].entries()) {
        const point = (attr(pattern, axis) + shift[index] + attr(circle, `c${axis}`)) * zoom + viewport[axis];
        const screenEdge = box[axis] * zoom + viewport[axis];
        const steps = (screenEdge - point) / (CANVAS_GRID_GAP * zoom);
        assert.ok(Math.abs(steps - Math.round(steps)) < 1e-8);
      }
      assert.equal(box.width, 317);
      assert.equal(box.height, 183);
      assert.notEqual(box.y, result.nodes[0].position.y);
    }
  });
}
