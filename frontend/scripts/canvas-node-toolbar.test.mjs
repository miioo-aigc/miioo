import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const readSource = (name) => readFile(new URL(`../src/components/canvas/${name}`, import.meta.url), 'utf8');
const toolbar = await readSource('CanvasNodeToolbar.jsx');
const shell = await readSource('CanvasNodeShell.jsx');
const textNode = await readSource('TextCanvasNode.jsx');
const actions = await readSource('UseCanvasNodeActions.js');
const presence = await readSource('CanvasCreationPresence.jsx');
const styles = await readSource('canvas-nodes.css');

test('上下间距均位于反向缩放层内，固定为8屏幕像素', () => {
  assert.match(styles, /\.canvas-node__toolbar-scale \{[^}]*top: 24px;[^}]*scale\(var\(--canvas-inverse-zoom, 1\)\) translateY\(calc\(-100% - 32px\)\)/);
  assert.match(styles, /\.canvas-creation-scale \{[^}]*padding-top: 8px;[^}]*scale\(var\(--canvas-inverse-zoom, 1\)\)/);
  assert.match(styles, /\.canvas-creation-panel \{[^}]*margin-top: 0;/);
  for (const zoom of [0.01, 0.5, 1, 1.5, 2, 4]) {
    const inverseZoom = 1 / zoom;
    const toolbarBottom = 24 * zoom + (-42 - 32 + 42) * inverseZoom * zoom;
    const headerTop = 24 * zoom - 24;
    assert.ok(Math.abs(headerTop - toolbarBottom - 8) < 1e-9);
    assert.ok(Math.abs(8 * inverseZoom * zoom - 8) < 1e-9);
  }
});

test('标题字号图标与间距固定，宽度匹配卡片屏幕宽度并保留省略', async () => {
  const header = await readSource('CanvasNodeHeader.jsx');
  const names = await readSource('CanvasEditableName.css');
  assert.ok(header.includes("'--canvas-header-inverse-zoom': 1 / zoom"));
  assert.ok(styles.includes('width: calc(100% * var(--canvas-header-zoom, 1))'));
  assert.ok(styles.includes('translateY(-24px)'));
  assert.ok(names.includes('text-overflow: ellipsis'));
  for (const zoom of [0.01, 0.5, 1, 2, 4]) {
    assert.equal(16 / zoom * zoom, 16);
    assert.equal(240 * zoom / zoom * zoom, 240 * zoom);
  }
});

test('工具栏与输入框共用激活条件和显隐动画，缩放补偿独立保留', () => {
  assert.equal((shell.match(/<CanvasCreationPresence open=\{creationOpen\}/g) || []).length, 2);
  assert.match(shell, /className="canvas-node__toolbar-scale" inert=\{!creationOpen\}/);
  assert.match(shell, /<CanvasCreationPresence open=\{creationOpen\} className="canvas-node__toolbar-presence">/);
  assert.match(presence, /duration: reduced \? 0 : open \? 300 : 200/);
  assert.match(styles, /\.canvas-node__toolbar-presence \{[^}]*transform-origin: bottom center;[^}]*transform: scale\(0.3\); opacity: 0;/);
});

test('工具栏复用透明图标按钮，图标不收缩且保留悬停提示', () => {
  assert.match(toolbar, /<IconButton[^>]*variant="link"/);
  assert.match(toolbar, /<Icon size=\{16\}[^>]*className="shrink-0"/);
  assert.match(toolbar, /<Tooltip key=\{key\} label=\{label\} placement="top"/);
});

test('空白正文禁止复制下载，但编辑与更多保留入口', () => {
  assert.match(toolbar, /Boolean\(content\?\.trim\(\)\)/);
  assert.match(toolbar, /disabled=\{isDisabled\(key\)\}/);
  assert.match(toolbar, /!enabled \|\| \(key !== 'edit' && !hasContent\)/);
  assert.match(textNode, /if \(!data\?\.content\?\.trim\(\)\) return/);
  assert.match(toolbar, /aria-label="更多" aria-haspopup="menu"/);
});

test('更多按按钮屏幕坐标打开共用菜单，单选当前卡片并保持激活', () => {
  const more = actions.slice(actions.indexOf('onMore:'), actions.indexOf('onContextMenu:'));
  assert.match(more, /setCanvasSelection\(current, \[nodeId\], true\)/);
  assert.match(more, /setMenu\(\{ id: nodeId, x: rect.right - 200, y: rect.bottom \+ 8 \}\)/);
  assert.match(toolbar, /onMore\?\.\(event.currentTarget.getBoundingClientRect\(\)\)/);
});

test('图标按住时使用白色60%，覆盖悬停色且不影响禁用态', () => {
  assert.match(styles, /\.canvas-node__toolbar-button:active:not\(:disabled\) \{ color: var\(--color-white-60\); \}/);
  assert.ok(styles.indexOf('.canvas-node__toolbar-button:active') > styles.indexOf('.canvas-node__toolbar-button:hover'));
});

test('节点外壳不插入节点编号，动作名称直接传至文本节点', () => {
  assert.match(toolbar, /onClick=\{\(\) => onAction\?\.\(key\)\}/);
  assert.match(shell, /<CanvasNodeToolbar[^>]*onAction=\{data\?\.onToolbarAction\}/);
  assert.match(textNode, /onToolbarAction: handleToolbarAction/);
  assert.match(textNode, /const handleToolbarAction = \(action\) =>/);
  for (const action of ['edit', 'copy', 'download']) {
    assert.ok(toolbar.includes(`key: '${action}'`));
    assert.ok(textNode.includes(`action === '${action}'`));
  }
});
