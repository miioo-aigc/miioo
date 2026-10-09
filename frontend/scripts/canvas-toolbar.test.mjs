import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getCanvasToolShortcut } from '../src/components/canvas/CanvasToolShortcuts.js';
import { planCanvasAssetImport, applyCanvasAsset } from '../src/components/canvas/CanvasAssets.js';
import { appendCanvasNode, createCanvasNode } from '../src/components/canvas/canvasNodeUtils.js';
import { createCanvasHistory } from '../src/components/canvas/CanvasHistory.js';

test('移动和抓手快捷键，以及编辑和弹窗保护', () => {
  assert.equal(getCanvasToolShortcut({ key: 'v' }), 'select');
  assert.equal(getCanvasToolShortcut({ key: 'h' }), 'hand');
  assert.equal(getCanvasToolShortcut({ key: 'h' }, false), null);
  for (const flag of ['defaultPrevented', 'isComposing', 'repeat', 'ctrlKey', 'metaKey', 'altKey', 'shiftKey']) {
    assert.equal(getCanvasToolShortcut({ key: 'v', [flag]: true }), null);
  }
  assert.equal(getCanvasToolShortcut({ key: 'v', keyCode: 229 }), null);
  assert.equal(getCanvasToolShortcut({ key: 'v', target: { isContentEditable: true } }), null);
  for (const selector of ['input', 'textarea', 'select', '[contenteditable="true"]', '[role="textbox"]', '[role="dialog"]']) {
    assert.equal(getCanvasToolShortcut({ key: 'h', target: { closest: (query) => query.includes(selector) } }), null);
  }
});

test('资产按类型导入、保留音频台词、多选错开且整批撤销重做', () => {
  const imports = planCanvasAssetImport([
    { asset_type: 'image', file_url: '/image.png' },
    { type: 'video/mp4', url: '/video.mp4' },
    { assetType: 'audio', audioUrl: '/audio.mp3', transcript: '台词' },
    { type: 'image', url: '' },
  ], { x: 500, y: 300 });
  assert.deepEqual(imports.map((item) => item.type), ['image', 'video', 'audio']);
  assert.deepEqual(imports.map((item) => item.position), [{ x: 380, y: 200 }, { x: 428, y: 248 }, { x: 476, y: 296 }]);
  const history = createCanvasHistory();
  history.begin();
  imports.forEach(({ type, position, asset }, index) => {
    const node = createCanvasNode(type, position, String(index));
    history.setNodes((nodes) => applyCanvasAsset(appendCanvasNode(nodes, node), node.id, asset));
  });
  history.end();
  assert.equal(history.getSnapshot().nodes.length, 3);
  assert.equal(history.getSnapshot().nodes[2].data.transcript, '台词');
  history.undo();
  assert.equal(history.getSnapshot().nodes.length, 0);
  history.redo();
  assert.equal(history.getSnapshot().nodes.length, 3);
  history.dispose();
});

test('工具栏隐藏入口、菜单后缀及收起布局契约', () => {
  const toolbar = readFileSync(new URL('../src/components/canvas/CanvasToolbar.jsx', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../src/components/canvas/CanvasToolbar.css', import.meta.url), 'utf8');
  assert.doesNotMatch(toolbar, /当前项目画布/);
  assert.match(toolbar, /key: 'search'.*hidden: true/);
  assert.match(toolbar, /key: 'share'.*hidden: true/);
  assert.match(toolbar, /filter\(\(item\) => !item.hidden\)/);
  assert.match(toolbar, /justify-between gap-\[12px\]/);
  assert.match(toolbar, /inert=\{!rightToolsExpanded\}/);
  assert.match(css, /:not\(.canvas-toolbar__right-tools--expanded\).*margin-left: -12px/);
});
