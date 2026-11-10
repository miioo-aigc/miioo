import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { shouldPauseCanvasVideo } from '../src/components/canvas/CanvasVideoInteraction.js';
import { hasBlockingDialog } from '../src/components/canvas/CanvasModalGuard.js';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('视频卡片激活时把选中态传给播放器以自动播放', () => {
  const node = read('../src/components/canvas/VideoCanvasNode.jsx');
  assert.doesNotMatch(node, /canvas-node__media nodrag/);
  assert.match(node, /<CanvasVideoPlayer[^>]*active=\{selected\}/);
});

test('激活态请求预览地址并带声自动播放，不随鼠标移入移出自动启停', () => {
  const player = read('../src/components/canvas/CanvasVideoPlayer.jsx');
  assert.match(player, /export default function CanvasVideoPlayer\(\{ src, poster, active = false \}\)/);
  assert.match(player, /video\.muted = false/);
  // 激活态有声播放（不静默降级）。
  assert.match(player, /void play\(\{ automatic: true \}\);/);
  // 悬停自动播放/暂停已移除，播放进度只由用户在控制条上决定。
  assert.doesNotMatch(player, /onPointerEnter|onPointerLeave|mutedFallback|setTimeout/);
  assert.match(player, /shouldPauseCanvasVideo\(active, containerRef\.current, event\?\.target\)/);
});

test('原生控制条只在卡片激活态出现', () => {
  const player = read('../src/components/canvas/CanvasVideoPlayer.jsx');
  assert.match(player, /<video[^>]*controls=\{active\}[^>]*playsInline/);
  assert.doesNotMatch(player, /useState/);
});

test('控制条显示时拖动层让位，隐藏时仍可拖动卡片', () => {
  const player = read('../src/components/canvas/CanvasVideoPlayer.jsx');
  // 视频自身隔离 React Flow 拖拽，控制条区域才能收到点击。
  assert.match(player, /<video ref=\{videoRef\} className="canvas-node__media nodrag nopan nowheel"/);
  // 拖动层只在底部控制条上方让位，其余区域仍可拖动卡片。
  assert.match(player, /className="canvas-video__drag-surface" data-controls=\{active \? 'true' : undefined\}/);
  const css = read('../src/components/canvas/canvas-nodes.css');
  assert.match(css, /\.canvas-video__drag-surface\[data-controls='true'\] \{ bottom: var\(--canvas-video-controls-height, 48px\); \}/);
});

test('卡片中央 32×32 播放按钮常驻，播放开始后收起', () => {
  const player = read('../src/components/canvas/CanvasVideoPlayer.jsx');
  // 按钮复用详情弹窗的圆形徽标，尺寸 32。
  assert.match(player, /<VideoCircleBadge size=\{32\}>/);
  // 播放中（status === 'playing'）不再渲染中央按钮。
  assert.match(player, /\{!playing && <button/);
  assert.match(player, /const playing = media\.status === 'playing'/);
  // 不再渲染任何文字状态层。
  assert.doesNotMatch(player, /MediaLoadStatus/);
});

test('自动播放只被可见的模态对话框阻断，常驻收起面板不阻断', () => {
  const player = read('../src/components/canvas/CanvasVideoPlayer.jsx');
  assert.match(player, /hasBlockingDialog\(\)/);
  assert.doesNotMatch(player, /document\.querySelector\('\[role="dialog"\]'\)/);
  const visible = { hasAttribute: () => false, getAttribute: () => null, getClientRects: () => [1] };
  const inert = { hasAttribute: (name) => name === 'inert', getAttribute: () => null, getClientRects: () => [1] };
  const ariaHidden = { hasAttribute: () => false, getAttribute: (name) => (name === 'aria-hidden' ? 'true' : null), getClientRects: () => [1] };
  const laidOut = { hasAttribute: () => false, getAttribute: () => null, getClientRects: () => [] };
  assert.equal(hasBlockingDialog({ querySelector: () => null }), false);
  assert.equal(hasBlockingDialog(undefined), false);
  assert.equal(hasBlockingDialog({ querySelector: () => visible }), true);
  assert.equal(hasBlockingDialog({ querySelector: () => inert }), false);
  assert.equal(hasBlockingDialog({ querySelector: () => ariaHidden }), false);
  assert.equal(hasBlockingDialog({ querySelector: () => laidOut }), false);
});

test('点击卡片自身不打断激活态播放，点击卡片之外或失活时停止', () => {
  const card = { contains: (node) => node === card };
  assert.equal(shouldPauseCanvasVideo(true, card, card), false);
  assert.equal(shouldPauseCanvasVideo(true, card, { id: 'outside' }), true);
  assert.equal(shouldPauseCanvasVideo(false, card, card), true);
});

test('窗口失焦等非 DOM 节点事件不抛错，按卡片之外停止', () => {
  const prevNode = globalThis.Node;
  globalThis.Node = class Node {};
  try {
    let containsCalled = false;
    const container = { contains: () => { containsCalled = true; return false; } };
    // window 不是 Node 实例，应直接判为卡片之外，且不调用 contains（避免抛 TypeError）。
    assert.equal(shouldPauseCanvasVideo(true, container, { id: 'window' }), true);
    assert.equal(containsCalled, false);
  } finally {
    if (prevNode === undefined) delete globalThis.Node;
    else globalThis.Node = prevNode;
  }
  // 无 Node 全局的环境（如纯 Node 运行测试）仍按 contains 判断。
  const card = { contains: (node) => node === card };
  assert.equal(shouldPauseCanvasVideo(true, card, card), false);
});
