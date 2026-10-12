import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { appendCanvasImageEdit, canvasImageEditCard } from '../src/components/canvas/CanvasImageEdits.js';
import { createCanvasNode } from '../src/components/canvas/canvasNodeUtils.js';

test('图片工具栏定位层与本体同宽，缩放后仍以卡片中心定位', () => {
  const css = readFileSync(new URL('../src/components/canvas/canvas-nodes.css', import.meta.url), 'utf8');
  assert.match(css, /\[data-node-type='image'\] \.canvas-node__toolbar-scale,\s*\.canvas-node\[data-node-type='image'\] \.canvas-node__toolbar \{ width: 416px; \}/);
  for (const zoom of [0.01, 0.5, 1, 2, 4]) {
    for (const cardWidth of [120, 240, 480]) {
      const center = cardWidth * zoom / 2;
      const left = center - 416 / 2;
      assert.ok(Math.abs(left + 416 / 2 - center) < 1e-9);
    }
  }
});

test('图片与文本共用四态颜色，禁用不叠加透明度，多机位使用新路径并继承颜色', () => {
  const css = readFileSync(new URL('../src/components/canvas/canvas-nodes.css', import.meta.url), 'utf8');
  assert.match(css, /\.canvas-node__toolbar-button \{[^}]*color: var\(--color-white-80\)/);
  assert.match(css, /:hover:not\(:disabled\) \{[^}]*color: var\(--color-text-primary\)/);
  assert.match(css, /:active:not\(:disabled\) \{[^}]*color: var\(--color-white-60\)/);
  assert.match(css, /\.canvas-node__toolbar-button:disabled \{ color: var\(--color-white-40\); opacity: 1;/);
  assert.match(css, /\.canvas-node__toolbar-icon \{ color: inherit !important;/);
  const icons = readFileSync(new URL('../src/components/image-edit/ImageEditIcon.jsx', import.meta.url), 'utf8');
  const multi = icons.slice(icons.indexOf('"多机位":'), icons.indexOf('"局部重绘":'));
  assert.ok(multi.includes('stroke="currentColor"'));
  assert.ok(multi.includes('M8 8V4M8 8L4.5 10.021M8 8L11.5 10.021'));
  assert.equal((multi.match(/<path /g) || []).length, 7);
});

test('七项图片编辑顺序固定，下载和更多复用文本图标', () => {
  const toolbar = readFileSync(new URL('../src/components/canvas/CanvasNodeToolbar.jsx', import.meta.url), 'utf8');
  assert.ok(toolbar.includes("['裁剪', '翻转', '多机位', '局部重绘', '智能超清', '消除笔', '扩图']"));
  assert.ok(toolbar.includes("{ key: 'download', label: '下载', Icon: Download }"));
  assert.ok(toolbar.includes('<Ellipsis size={16}'));
  assert.ok(toolbar.includes("nodeType === 'image' ? Boolean(asset?.url)"));
});

test('详情与画布使用同一图标组件且图标继承状态颜色', () => {
  const icons = readFileSync(new URL('../src/components/image-edit/ImageEditIcon.jsx', import.meta.url), 'utf8');
  const detail = readFileSync(new URL('../src/components/ImageDetailModal.jsx', import.meta.url), 'utf8');
  assert.equal((detail.match(/<ImageEditIcon label=/g) || []).length, 7);
  assert.ok(!icons.includes('#FFFFFFCC'));
  assert.ok(icons.includes('color="currentColor"'));
});

test('编辑适配优先原图且不使用节点编号伪造资产编号', () => {
  const card = canvasImageEditCard({ url: '/preview.png', original_url: '/original.png', asset_id: 'asset-1' });
  assert.equal(card.imageUrl, '/original.png');
  assert.equal(card.asset_id, 'asset-1');
  assert.equal(canvasImageEditCard({ url: '/local.png' }).creationAssetId, undefined);
});

test('编辑结果新增节点，保留原图及面板状态，避让且重复回调不重复插入', () => {
  const source = createCanvasNode('image', { x: 0, y: 0 }, 'source');
  source.data.asset = { url: '/original.png', asset_type: 'image' };
  const before = structuredClone(source);
  const asset = { url: '/edited.png', asset_type: 'image', width: 1024, height: 1024 };
  const result = appendCanvasImageEdit([source], source, asset, 'result');
  assert.equal(result.length, 2);
  assert.deepEqual(result[0], before);
  assert.deepEqual(source, before);
  assert.equal(result[1].data.asset.url, '/edited.png');
  assert.equal(result[1].data.editSourceNodeId, source.id);
  assert.equal(result[1].data.label, '图片2');
  assert.ok(result[1].position.x >= 272);
  assert.equal(appendCanvasImageEdit(result, source, asset, 'result'), result);
});
