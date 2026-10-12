import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { appendCanvasMediaEdit } from '../src/components/canvas/CanvasImageEdits.js';
import { createCanvasNode } from '../src/components/canvas/canvasNodeUtils.js';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('图片与视频超清仅默认态共用亮度补偿', () => {
  const css = read('src/components/canvas/canvas-nodes.css');
  const selector = (type) => `.canvas-node[data-node-type='${type}'] .canvas-node__toolbar-button[aria-label='智能超清']:not(:hover):not(:active):not(:disabled) svg`;
  assert.ok(css.includes(`${selector('image')},\n${selector('video')} { opacity: 0.75; }`));
});

test('视频结果与选帧新增正确类型、保留源节点并去重', () => {
  for (const type of ['video', 'image']) {
    const source = createCanvasNode('video', { x: 100, y: 100 }, 'source');
    source.data.asset = { asset_type: 'video', url: '/original.mp4' };
    const asset = { asset_type: type, url: '/result', width: 1920, height: 1080 };
    const result = appendCanvasMediaEdit([source], source, asset, 'result', type);
    assert.equal(result.length, 2);
    assert.equal(result[0].data.asset.url, '/original.mp4');
    assert.equal(result[1].type, type);
    assert.equal(result[1].data.editSourceNodeId, 'source');
    assert.notDeepEqual(result[1].position, source.position);
    assert.equal(appendCanvasMediaEdit(result, source, asset, 'result', type), result);
  }
});

test('视频音频共用固定尺寸定位与工具栏，视频编辑限制真实媒体类型', () => {
  const toolbar = read('src/components/canvas/CanvasNodeToolbar.jsx');
  assert.ok(toolbar.includes("['智能超清', '去字幕', '选帧', '剪辑']"));
  assert.ok(toolbar.includes("asset?.asset_type !== 'video'"));
  assert.ok(toolbar.includes('<VideoEditIcon label={label} />'));
  const css = read('src/components/canvas/canvas-nodes.css');
  for (const [type, width] of [['video', 284], ['audio', 108]]) {
    assert.ok(css.includes(`[data-node-type='${type}'] .canvas-node__toolbar-scale,\n.canvas-node[data-node-type='${type}'] .canvas-node__toolbar { width: ${width}px; }`));
  }
});

test('图标由详情与画布复用，颜色继承四态规则', () => {
  assert.ok(read('src/components/CreationVideoDetailModal.jsx').includes('<VideoEditIcon label="剪辑" />'));
  assert.doesNotMatch(read('src/components/video-edit/VideoEditIcon.jsx'), /#[A-Fa-f0-9]{6}/);
});
