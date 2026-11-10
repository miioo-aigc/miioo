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
  assert.match(addMenu, /onUpload=\{onUpload\}/);
  assert.match(addMenu, /onSelectAssets=\{onSelectAssets\}/);
});

test('底部工具栏新建菜单复用空白双击菜单的上传与资产库入口', () => {
  const toolbar = readFileSync(new URL('../src/components/canvas/CanvasToolbar.jsx', import.meta.url), 'utf8');
  const page = readFileSync(new URL('../src/pages/CanvasPage.jsx', import.meta.url), 'utf8');
  for (const handler of ['handleToolbarUpload', 'handleToolbarSelectAssets']) {
    assert.match(page, new RegExp(`const ${handler} = useCallback`));
  }
  assert.match(page, /onUpload=\{handleToolbarUpload\}/);
  assert.match(page, /onSelectAssets=\{handleToolbarSelectAssets\}/);
  assert.match(toolbar, /onUpload=\{onUpload\}/);
  assert.match(toolbar, /onSelectAssets=\{onSelectAssets\}/);
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

test('空白右键与展开组右键的新建节点二级菜单复用上传与资产库入口', async () => {
  const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom' });
  globalThis.document = { body: { nodeType: 1 } };
  globalThis.window = { innerWidth: 1280, innerHeight: 800 };
  try {
    const { default: CanvasNodeActionOverlays } = await server.ssrLoadModule('/src/components/canvas/CanvasNodeActionOverlays.jsx');
    // createPortal 返回的是 portal 对象（子元素直接挂在 children 上），不是 React 元素，这里两种形态都兼容。
    const menuItemsOf = (tree) => {
      const portal = tree.props.children[0];
      return (portal.props ? portal.props.children : portal.children).props.items;
    };
    const base = { dialog: null, nodes: [], canPaste: false, canUndo: false, canRedo: false,
      onAction: () => {}, onCloseMenu: () => {}, onCloseDialog: () => {}, onConfirm: () => {}, onAddNode: () => {} };

    const paneCalls = [];
    const paneItems = menuItemsOf(CanvasNodeActionOverlays({ ...base,
      menu: { kind: 'pane', x: 12, y: 16, flowPosition: { x: 100, y: 200 } },
      onUpload: (target) => paneCalls.push(['upload', target]),
      onSelectAssets: (target) => paneCalls.push(['assets', target]) }));
    const paneCreate = paneItems[0];
    assert.equal(paneCreate.key, 'create');
    assert.deepEqual(paneCreate.items.slice(0, 4).map((entry) => entry.key), ['text', 'image', 'video', 'audio']);
    assert.equal(paneCreate.items[4].type, 'separator');
    assert.equal(paneCreate.items[5].label, '本地上传');
    assert.equal(paneCreate.items[6].label, '从资产库选择');
    paneCreate.items[5].onClick();
    paneCreate.items[6].onClick();
    assert.deepEqual(paneCalls, [
      ['upload', { flowPosition: { x: 100, y: 200 }, parentId: undefined }],
      ['assets', { flowPosition: { x: 100, y: 200 }, parentId: undefined }],
    ]);

    const groupCalls = [];
    const group = { id: 'g', type: 'canvasGroup', position: { x: 0, y: 0 }, style: { width: 600, height: 400 }, data: { label: '组' } };
    const groupMenu = { id: 'g', x: 20, y: 30, flowPosition: { x: 40, y: 50 } };
    const groupCreate = menuItemsOf(CanvasNodeActionOverlays({ ...base, nodes: [group], menu: groupMenu,
      onUpload: (target) => groupCalls.push(['upload', target]),
      onSelectAssets: (target) => groupCalls.push(['assets', target]) }))[0];
    assert.deepEqual(groupCreate.items.slice(0, 4).map((entry) => entry.key), ['text', 'image', 'video', 'audio']);
    assert.deepEqual(groupCreate.items.slice(5).map((entry) => entry.label), ['本地上传', '从资产库选择']);
    groupCreate.items[5].onClick();
    groupCreate.items[6].onClick();
    assert.deepEqual(groupCalls, [
      ['upload', { flowPosition: { x: 40, y: 50 }, parentId: 'g' }],
      ['assets', { flowPosition: { x: 40, y: 50 }, parentId: 'g' }],
    ]);

    const plainItems = menuItemsOf(CanvasNodeActionOverlays({ ...base,
      menu: { kind: 'pane', x: 12, y: 16, flowPosition: { x: 100, y: 200 } } }));
    assert.deepEqual(plainItems[0].items.map((entry) => entry.key), ['text', 'image', 'video', 'audio']);
  } finally {
    delete globalThis.document;
    delete globalThis.window;
    await server.close();
  }
});

test('右键菜单入口接上页面共用上传与资产库链路，并把组归属带进导入', () => {
  const page = readFileSync(new URL('../src/pages/CanvasPage.jsx', import.meta.url), 'utf8');
  assert.match(page, /onUpload=\{openMenuUpload\} onSelectAssets=\{openMenuAssetPicker\}/);
  assert.match(page, /menuUploadTargetRef\.current = \{ flowPosition: target\.flowPosition, parentId: target\.parentId, session: saveSessionRef\.current \}/);
  assert.match(page, /uploadFiles\(files, \{ flowPosition: target\.flowPosition, parentId: target\.parentId \}\)/);
  assert.match(page, /setAssetTarget\(\{ flowPosition: target\.flowPosition, parentId: target\.parentId \}\)/);
  assert.match(page, /imports\.forEach\(\(\{ type, position, asset \}\) => addNode\(type, position, null, asset, target\?\.parentId\)\)/);
});
