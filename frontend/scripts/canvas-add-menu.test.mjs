import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createTestViteServer as createServer } from './lib/create-test-vite-server.mjs';

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
    for (const item of menu.props.children.flat().filter(Boolean)) item.props.onClick();
    assert.deepEqual(selected, ['text', 'image', 'video', 'audio']);

    const standalone = CanvasNodeAddMenu({});
    assert.equal(standalone.props.className, 'canvas-node-add-menu');
    assert.equal(standalone.props.style, undefined);

    const actions = [];
    const extended = CanvasNodeAddMenu({
      onUpload: () => actions.push('upload'),
      onSelectAssets: () => actions.push('assets'),
    });
    const extraItems = extended.props.children[1].props.children;
    assert.equal(extraItems[0].props.role, 'separator');
    assert.equal(extraItems[1].props.children[1].props.children, '本地上传');
    assert.equal(extraItems[2].props.children[1].props.children, '从资产库选择');
    extraItems[1].props.onClick();
    extraItems[2].props.onClick();
    assert.deepEqual(actions, ['upload', 'assets']);
  } finally {
    await server.close();
  }
});
