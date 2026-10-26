import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ReactFlow } from '@xyflow/react';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';

let server;
let GroupNode;
before(async () => {
  server = await createServer({ configFile: false, plugins: [react()], appType: 'custom', server: { middlewareMode: true, hmr: false, ws: false } });
  GroupNode = (await server.ssrLoadModule('/src/components/canvas/CanvasGroupNode.jsx')).default;
});
after(async () => { await server?.close(); });

test('分享组名只读且空折叠封面不出现编辑和上传入口', () => {
  const markup = renderToStaticMarkup(createElement(ReactFlow, {
    width: 800, height: 600, nodesDraggable: false, elementsSelectable: false,
    nodeTypes: { canvasGroup: GroupNode },
    nodes: [{ id: 'group', type: 'canvasGroup', position: { x: 0, y: 0 }, width: 312, height: 312,
      data: { label: '只读组', readOnly: true, stacked: true, stackMembers: [{ id: 'child', type: 'text', readOnly: true }] } }],
  }));
  assert.match(markup, /只读组/);
  assert.match(markup, /暂无内容/);
  assert.doesNotMatch(markup, /canvas-editable-name|双击编辑|本地上传|<input/);
});

for (const stacked of [false, true]) {
  test(`${stacked ? '堆叠' : '展开'}态保留可测量但不可交互的组连接点`, () => {
    const markup = renderToStaticMarkup(createElement(ReactFlow, {
      width: 800, height: 600, nodeTypes: { canvasGroup: GroupNode },
      nodes: [{ id: 'group', type: 'canvasGroup', position: { x: 0, y: 0 }, width: 312, height: 312,
        data: { label: '组合', stacked, stackMembers: [] } }],
    }));
    for (const id of ['stack-input', 'stack-output']) {
      const handle = markup.match(new RegExp(`<div[^>]*data-handleid="${id}"[^>]*>`))?.[0];
      assert.ok(handle, `${id} 必须在切换前后始终挂载`);
      assert.match(handle, /opacity:0/);
      assert.match(handle, /pointer-events:none/);
      assert.doesNotMatch(handle, /display:none|visibility:hidden|\sconnectable\s/);
    }
  });
}
