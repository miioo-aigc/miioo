import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../src/components/${path}`, import.meta.url), 'utf8');

test('节点生成时隐藏内部内容但保留布局与端口，发送按钮防止重复提交', () => {
  const shell = read('canvas/CanvasNodeShell.jsx');
  assert.match(shell, /import CanvasGenerationLoading, \{ CanvasGenerationFallback \} from '\.\/CanvasGenerationLoading'/);
  assert.match(shell, /<div className="canvas-node__result-body" aria-hidden=\{generating\} inert=\{Boolean\(generating \|\| submissionLocked\)\}>\{children\}<\/div>/);
  assert.match(shell, /generating && <CanvasEffectBoundary fallback=\{<CanvasGenerationFallback message=\{data\.generationMessage\} \/>\}>/);
  assert.match(shell, /<CanvasGenerationLoading key=\{generationKey\}/);
  assert.match(shell, /aria-busy=\{generating\}/);
  const css = read('canvas/canvas-nodes.css');
  assert.match(css, /\.canvas-node__frame\[aria-busy='true'\] > :not\(\.canvas-node__port\):not\(\.canvas-node__loading\)\s*\{\s*visibility: hidden;\s*pointer-events: none;\s*\}/);
  const resultCss = read('canvas/CanvasNodeResultControls.css');
  assert.match(resultCss, /\.canvas-node__result-body \{ display: contents; \}/);
  assert.match(resultCss, /\.canvas-node__result-body\[aria-hidden='true'\]\s*\{\s*visibility: hidden;\s*pointer-events: none;\s*\}/);
  assert.match(css, /\.canvas-node__frame \{[^}]*min-height: 240px/);
  assert.match(shell, /<CanvasNodePorts ports=\{data\?\.ports\}/);
  assert.match(css, /\.canvas-node__loading \{[^}]*position: absolute;[^}]*inset: 0;[^}]*pointer-events: none;/);
  const animation = read('canvas/CanvasGenerationLoading.jsx');
  assert.match(animation, /className="canvas-node__loading canvas-generation-loading" role="status"/);
  assert.match(animation, /<CanvasGenerationShader reducedMotion=\{reducedMotion\} \/>/);
  assert.doesNotMatch(animation, /canvas-generation-loading__(?:aurora|grid|sweep)/);
  assert.match(animation, /<ProgressMessage message=\{text\}/);
  const shader = read('canvas/CanvasGenerationShader.jsx');
  assert.match(shader, /from '@paper-design\/shaders'/);
  assert.match(shader, /dotOrbitFragmentShader/);
  assert.match(shader, /meshGradientFragmentShader/);
  assert.match(shader, /new ShaderMount/);
  assert.match(shader, /webglcontextlost/);
  assert.match(shader, /setAvailable\(false\)/);
  assert.match(shader, /colors = \['#FFFFFF0A'\]/);
  assert.match(shader, /colors = \['#FFFFFF99', '#00000080', '#2DC3E1'\]/);
  assert.match(shader, /9563964\.609994078/);
  assert.match(shader, /17999729\.999991026/);
  const loadingCss = read('canvas/CanvasGenerationLoading.css');
  assert.match(loadingCss, /\.canvas-generation-loading__shader--orbit \{ z-index: 0; background: #000000;/);
  assert.match(loadingCss, /\.canvas-generation-loading__shader--mesh/);
  assert.match(loadingCss, /mix-blend-mode: color-dodge/);
  assert.doesNotMatch(loadingCss, /canvas-generation-(?:aurora|grid|sweep)/);
  const panel = read('canvas/CanvasCreationPanel.jsx');
  assert.match(panel, /<CreationSendButton[^\n]*disabled=\{generating \|\| submitting \|\| !modelAvailable\}/);
  assert.match(panel, /if \(generating \|\| submitting \|\| composingRef.current \|\| !modelAvailable\) return/);
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
