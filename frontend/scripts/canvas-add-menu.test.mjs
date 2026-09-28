import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createServer } from 'vite';

test('工具栏添加入口只定位共用菜单，不嵌套另一套面板', () => {
  const source = readFileSync(new URL('../src/components/canvas/CanvasToolbar.jsx', import.meta.url), 'utf8');
  const addMenu = source.match(/function AddNodeMenu\([^]*?\n}/)?.[0];
  assert.ok(addMenu);
  assert.doesNotMatch(addMenu, /ToolbarMenu|\bembedded\b/);
  assert.match(addMenu, /<CanvasNodeAddMenu onAddNode=\{onAddNode\}/);
});

test('共用添加节点菜单保留完整面板和四种节点回调', async () => {
  const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom' });
  try {
    const { default: CanvasNodeAddMenu } = await server.ssrLoadModule('/src/components/canvas/CanvasNodeAddMenu.jsx');
    const selected = [];
    const menu = CanvasNodeAddMenu({ onAddNode: (type) => selected.push(type) });
    assert.equal(menu.props.role, 'menu');
    for (const item of menu.props.children) item.props.onClick();
    assert.deepEqual(selected, ['text', 'image', 'video', 'audio']);

    const standalone = CanvasNodeAddMenu({});
    assert.equal(standalone.props.className, 'canvas-node-add-menu');
    assert.equal(standalone.props.style, undefined);
  } finally {
    await server.close();
  }
});
