import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

test('正文编辑时排除悬停描边并保留创作输入框', () => {
  const css = readFileSync(new URL('../src/components/canvas/canvas-nodes.css', import.meta.url), 'utf8');
  const shell = readFileSync(new URL('../src/components/canvas/CanvasNodeShell.jsx', import.meta.url), 'utf8');
  assert.ok(css.includes(".canvas-node:hover .canvas-node__frame:not([data-state='editing'])"));
  assert.match(shell, /selected && data\?\.creationPanelOpen/);
});

test('文本节点单选不新增蓝框，保留正文编辑或创作输入聚焦描边', () => {
  const css = readFileSync(new URL('../src/components/canvas/canvas-nodes.css', import.meta.url), 'utf8');
  const shell = readFileSync(new URL('../src/components/canvas/CanvasNodeShell.jsx', import.meta.url), 'utf8');
  assert.match(shell, /data-node-type=\{nodeType\}/);
  assert.doesNotMatch(css, /\.canvas-node--selected \.canvas-node__frame/);
  assert.doesNotMatch(css, /\.canvas-node--selected[^}]*border-color/);
  assert.ok(css.includes('.canvas-node:has(.canvas-creation-panel__editor:focus) > .canvas-node__frame'));
  assert.ok(css.includes(".canvas-node__frame[data-state='editing']"));
});

test('新增或单击节点不描边外壳，多选描边仅作用于卡片本体', () => {
  const css = readFileSync(new URL('../src/components/canvas/canvas-nodes.css', import.meta.url), 'utf8');
  assert.doesNotMatch(css, /\.react-flow__node\.selected\s*>\s*\.canvas-node\s*\{/);
  const selector = '.react-flow__nodes:has(> .react-flow__node.selected ~ .react-flow__node.selected) > .react-flow__node.selected > .canvas-node > .canvas-node__frame';
  assert.ok(css.includes(`${selector} { border-color: var(--color-stroke-active); }`));
});

test('四类节点直接复用公共上传按钮', () => {
  for (const type of ['Text', 'Image', 'Video', 'Audio']) {
    const source = readFileSync(new URL(`../src/components/canvas/${type}CanvasNode.jsx`, import.meta.url), 'utf8');
    assert.match(source, /import FileUploadButton from '..\/ui\/FileUploadButton'/);
    assert.match(source, /<FileUploadButton/);
  }
});

test('文本卡片原地编辑复用正文并隔离画布键盘事件', () => {
  const source = readFileSync(new URL('../src/components/canvas/TextCanvasNode.jsx', import.meta.url), 'utf8');
  assert.match(source, /<textarea/);
  assert.match(source, /value=\{data\?\.content \|\| ''\}/);
  assert.match(source, /onBlur=\{\(\) => setEditing\(false\)\}/);
  assert.match(source, /onKeyDown=\{\(event\) => event.stopPropagation\(\)\}/);
  assert.match(source, /onContentChange\?\.\(id, event.target.value\)/);
});
import {
  CANVAS_NODE_TYPES,
  createCanvasNode,
  appendCanvasNode,
  getCreationPanelVisibility,
  getCanvasNodeMenuPosition,
} from '../src/components/canvas/canvasNodeUtils.js';
import { CANVAS_NODE_MENU_ITEMS } from '../src/components/canvas/CanvasNodeAddMenuConfig.js';
import { readCanvasTextFile } from '../src/components/canvas/CanvasTextFileReader.js';

test('四种节点分别按当前最大序号递增，删除后不重排、不填中间空号', () => {
  let nodes = [];
  for (const [type, label] of Object.entries({ text: '文本', image: '图片', video: '视频', audio: '音频' })) {
    for (let sequence = 1; sequence <= 3; sequence++) {
      nodes = appendCanvasNode(nodes, createCanvasNode(type));
      assert.equal(nodes.at(-1).data.sequence, sequence);
      assert.equal(nodes.at(-1).data.label, `${label}${sequence}`);
    }
    const middle = nodes.find((node) => node.type === type && node.data.sequence === 2);
    nodes = nodes.filter((node) => node.id !== middle.id);
    nodes = appendCanvasNode(nodes, createCanvasNode(type));
    assert.deepEqual(nodes.filter((node) => node.type === type).map((node) => node.data.sequence), [1, 3, 4]);
    assert.equal(nodes.at(-1).data.label, `${label}4`);
  }
});

test('删除最大序号后可复用序号，但不能复用节点身份；删空后从1开始', () => {
  for (const type of CANVAS_NODE_TYPES) {
    let nodes = appendCanvasNode([], createCanvasNode(type));
    nodes = appendCanvasNode(nodes, createCanvasNode(type));
    const removedId = nodes.at(-1).id;
    const remaining = nodes.slice(0, 1);
    nodes = appendCanvasNode(remaining, createCanvasNode(type));
    assert.equal(nodes.at(-1).data.sequence, 2);
    assert.notEqual(nodes.at(-1).id, removedId);
    assert.equal(remaining[0].data.sequence, 1);
    assert.equal(remaining[0].selected, false);
    assert.equal(nodes.at(-1).selected, true);
    nodes = appendCanvasNode([], createCanvasNode(type));
    assert.equal(nodes.at(-1).data.sequence, 1);
  }
});

test('四类节点都有稳定类型、位置和输入输出端口', () => {
  for (const type of CANVAS_NODE_TYPES) {
    const node = createCanvasNode(type, { x: 120, y: 240 });

    assert.equal(node.type, type);
    assert.deepEqual(node.position, { x: 120, y: 240 });
    assert.equal(node.data.nodeType, type);
    assert.ok(node.data.ports.input.id);
    assert.ok(node.data.ports.output.id);
  }
});

test('节点创建时默认展开创作面板，但不表示已经持久化', () => {
  const node = createCanvasNode('text');

  assert.equal(node.data.creationPanelOpen, true);
  assert.equal(node.data.persistenceState, 'draft');
});

test('只有当前选中节点显示创作面板', () => {
  const node = createCanvasNode('image');

  assert.equal(getCreationPanelVisibility(node, node.id), true);
  assert.equal(getCreationPanelVisibility(node, 'another-node'), false);
  assert.equal(getCreationPanelVisibility({ ...node, selected: false }, node.id), false);
});

test('双击菜单位置会被限制在画布可视区域内', () => {
  assert.deepEqual(
    getCanvasNodeMenuPosition({ clientX: 780, clientY: 560 }, { width: 800, height: 600 }),
    { left: 632, top: 416 },
  );
  assert.deepEqual(
    getCanvasNodeMenuPosition({ clientX: 12, clientY: 18 }, { width: 800, height: 600 }),
    { left: 12, top: 18 },
  );
});

test('画布使用标准双击事件并关闭双击缩放，仅响应空白面板', () => {
  const page = readFileSync(new URL('../src/pages/CanvasPage.jsx', import.meta.url), 'utf8');
  assert.match(page, /zoomOnDoubleClick=\{false\}/);
  assert.match(page, /onDoubleClick=\{handlePaneDoubleClick\}/);
  assert.doesNotMatch(page, /onPaneDoubleClick=/);
  assert.match(page, /event\.target\.classList\.contains\('react-flow__pane'\)/);
});

test('共享添加菜单提供四类节点', () => {
  assert.deepEqual(CANVAS_NODE_MENU_ITEMS.map((item) => item.value), CANVAS_NODE_TYPES);
  assert.equal(existsSync(resolve('src/components/canvas/CanvasNodeAddMenu.js')), true);
});

test('新增节点不自动适配缩放，输入框以固定宽度节点为中心', () => {
  const page = readFileSync(new URL('../src/pages/CanvasPage.jsx', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../src/components/canvas/canvas-nodes.css', import.meta.url), 'utf8');
  assert.doesNotMatch(page, /<ReactFlow\s+fitView\b/);
  assert.match(page, /defaultViewport=\{\{ x: 0, y: 0, zoom: 1 \}\}/);
  const shell = css.match(/\.canvas-node \{([^}]+)\}/)[1];
  const panel = css.match(/\.canvas-creation-panel \{([^}]+)\}/)[1];
  assert.match(shell, /width: 240px;/);
  assert.match(panel, /position: relative;/);
  assert.match(panel, /left: 50%;/);
  assert.match(panel, /transform: translateX\(-50%\);/);
});

test('移动工具拖节点，抓手工具只移动画布', () => {
  const page = readFileSync(new URL('../src/pages/CanvasPage.jsx', import.meta.url), 'utf8');
  assert.match(page, /nodesDraggable=\{activeTool !== 'hand'\}/);
  assert.match(page, /panOnDrag=\{activeTool === 'hand'\}/);
  assert.match(page, /onNodeDragStart=\{handleNodeDragStart\}/);
  assert.match(page, /onNodeDragStop=\{handleNodeDragStop\}/);
});

test('触控板双指手势缩放并自由方向平移画布', () => {
  const page = readFileSync(new URL('../src/pages/CanvasPage.jsx', import.meta.url), 'utf8');
  assert.match(page, /PanOnScrollMode/);
  assert.match(page, /zoomOnPinch=\{true\}/);
  assert.match(page, /panOnScroll=\{true\}/);
  assert.match(page, /panOnScrollMode=\{PanOnScrollMode\.Free\}/);
  assert.match(page, /panOnScrollSpeed=\{0\.5\}/);
});

test('触控板手势在普通节点卡片上继续传递，编辑滚动区保持隔离', () => {
  const page = readFileSync(new URL('../src/pages/CanvasPage.jsx', import.meta.url), 'utf8');
  assert.match(page, /onWheelCapture=\{handleCanvasWheelCapture\}/);
  assert.match(page, /target\.closest\('\.nowheel'\)/);
  assert.match(page, /nodeElement\.classList\.remove\('nopan'\)/);
  assert.match(page, /nodeElement\.classList\.add\('nopan'\)/);
});

test('节点拖动状态提供轻微拉伸和回弹动效', () => {
  const shell = readFileSync(new URL('../src/components/canvas/CanvasNodeShell.jsx', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../src/components/canvas/canvas-nodes.css', import.meta.url), 'utf8');
  assert.match(shell, /data-dragging=\{data\?\.dragging \? 'true' : 'false'\}/);
  assert.match(css, /canvas-node__frame\[data-dragging='true'\]/);
  assert.match(css, /canvas-node__frame\[data-drag-release='true'\]/);
});

test('节点拖动形变跟随拖动方向变化，不使用固定横向压扁', () => {
  const page = readFileSync(new URL('../src/pages/CanvasPage.jsx', import.meta.url), 'utf8');
  const shell = readFileSync(new URL('../src/components/canvas/CanvasNodeShell.jsx', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../src/components/canvas/canvas-nodes.css', import.meta.url), 'utf8');
  assert.match(page, /onNodeDrag=\{handleNodeDrag\}/);
  assert.match(page, /dragScaleX/);
  assert.match(page, /dragScaleY/);
  assert.match(shell, /--canvas-drag-scale-x/);
  assert.match(shell, /--canvas-drag-scale-y/);
  assert.doesNotMatch(css, /scaleX\(1\.025\) scaleY\(0\.985\)/);
});

test('节点拖动形变幅度足够明显但仍有上限', () => {
  const page = readFileSync(new URL('../src/pages/CanvasPage.jsx', import.meta.url), 'utf8');
  assert.match(page, /Math\.min\(0\.2,/);
  assert.match(page, /stretch \* 0\.24/);
});

test('节点拖动不使用倾斜，只保留方向性拉伸和反向回弹', () => {
  const page = readFileSync(new URL('../src/pages/CanvasPage.jsx', import.meta.url), 'utf8');
  const shell = readFileSync(new URL('../src/components/canvas/CanvasNodeShell.jsx', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../src/components/canvas/canvas-nodes.css', import.meta.url), 'utf8');
  assert.doesNotMatch(page, /dragSkewX|dragSkewY|Math\.min\(2,/);
  assert.doesNotMatch(shell, /canvas-drag-skew-x|canvas-drag-skew-y/);
  assert.doesNotMatch(css, /skewX|skewY/);
  assert.match(css, /scale\(var\(--canvas-drag-scale-x\), var\(--canvas-drag-scale-y\)\)/);
});

test('文本节点单击等待双击判定后再展开创作框', () => {
  const page = readFileSync(new URL('../src/pages/CanvasPage.jsx', import.meta.url), 'utf8');
  const textNode = readFileSync(new URL('../src/components/canvas/TextCanvasNode.jsx', import.meta.url), 'utf8');
  assert.match(page, /CANVAS_SINGLE_CLICK_DELAY = \d+/);
  assert.match(page, /setTimeout\(\(\) =>/);
  assert.match(page, /onCancelPendingClick/);
  assert.match(textNode, /onCancelPendingClick/);
  assert.match(textNode, /onEnterEditing/);
});

test('文本节点文件读取支持 txt、md 和 docx', async () => {
  const textFile = { name: 'scene.txt', text: async () => '第一场\n室内' };
  assert.equal(await readCanvasTextFile(textFile), '第一场\n室内');

  const markdownFile = { name: 'scene.md', text: async () => '# 第一场' };
  assert.equal(await readCanvasTextFile(markdownFile), '# 第一场');

  await assert.rejects(() => readCanvasTextFile({ name: 'scene.pdf', text: async () => '' }), /仅支持/);
});

test('画布输入复用公共皮肤与创作发送按钮，不保留独立发送皮肤', () => {
  const panel = readFileSync(new URL('../src/components/canvas/CanvasCreationPanel.jsx', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../src/components/canvas/canvas-nodes.css', import.meta.url), 'utf8');
  assert.match(panel, /<ComposerSurface/);
  assert.match(panel, /<CreationSendButton/);
  assert.match(panel, /composer-surface__editor/);
  assert.doesNotMatch(css, /\.canvas-node__generate/);
});
