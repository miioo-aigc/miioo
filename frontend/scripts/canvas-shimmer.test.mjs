import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../src/components/${path}`, import.meta.url), 'utf8');

test('节点生成时隐藏内部内容但保留布局与端口，发送按钮不切换外观', () => {
  const shell = read('canvas/CanvasNodeShell.jsx');
  assert.match(shell, /import LoadingAnimation from '\.\.\/LoadingAnimation'/);
  assert.doesNotMatch(shell, /ShimmerEffect/);
  assert.match(shell, /\{data\?\.generating && <div className="canvas-node__loading" aria-hidden="true">/);
  assert.match(shell, /<LoadingAnimation width="auto" style=\{\{ height: 32 \}\} \/>/);
  assert.match(shell, /aria-busy=\{Boolean\(data\?\.generating\)\}/);
  const css = read('canvas/canvas-nodes.css');
  assert.match(css, /\.canvas-node__frame\[aria-busy='true'\] > :not\(\.canvas-node__port\):not\(\.canvas-node__loading\)\s*\{\s*visibility: hidden;\s*pointer-events: none;\s*\}/);
  assert.match(css, /\.canvas-node__loading \{ position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none; \}/);
  assert.match(read('LoadingAnimation.jsx'), /aspectRatio: '1118 \/ 405'/);
  const panel = read('canvas/CanvasCreationPanel.jsx');
  assert.doesNotMatch(panel, /<CreationSendButton[^>]*(?:loading|disabled)=/);
  assert.match(panel, /if \(generating \|\| composingRef.current\) return/);
});

test('剧本复用公共扫光，效果不拦截鼠标且支持减少动态效果', () => {
  assert.match(read('script/ScriptOutlineLoading.jsx'), /<ShimmerEffect/);
  assert.doesNotMatch(read('script/ScriptOutlineLoading.jsx'), /@keyframes script-outline-shimmer/);
  assert.match(read('ui/ShimmerEffect.jsx'), /if \(!active\) return null/);
  const css = read('ui/ShimmerEffect.css');
  assert.match(css, /pointer-events: none/);
  assert.match(css, /overflow: hidden/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /2.6s ease-in-out infinite/);
});
