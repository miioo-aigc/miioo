import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('保留原生控件，透明画面层响应节点拖动', () => {
  const node = readFileSync(new URL('../src/components/canvas/VideoCanvasNode.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(node, /canvas-node__media nodrag/);
  assert.match(node, /<CanvasVideoPlayer/);
  const player = readFileSync(new URL('../src/components/canvas/CanvasVideoPlayer.jsx', import.meta.url), 'utf8');
  assert.match(player, /controls=\{controlsVisible\}/);
  assert.match(player, /className="canvas-video__drag-surface"/);
  assert.doesNotMatch(player, /IconButton|type="range"/);
  assert.match(player, /onClick=\{\(event\) => event.stopPropagation\(\)\}/);
});

test('视频控制条默认隐藏，悬停或键盘聚焦时显示', () => {
  const css = readFileSync(new URL('../src/components/canvas/canvas-nodes.css', import.meta.url), 'utf8');
  const player = readFileSync(new URL('../src/components/canvas/CanvasVideoPlayer.jsx', import.meta.url), 'utf8');
  assert.match(player, /useState\(false\)/);
  assert.match(player, /onMouseEnter=\{\(\) => setHovered\(true\)\}/);
  assert.match(player, /onMouseLeave=\{\(\) => setHovered\(false\)\}/);
  assert.match(css, /data-controls-visible='true'[^}]*bottom: 56px/);
});
