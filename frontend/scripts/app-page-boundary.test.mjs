import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const source = read('src/components/feedback/PageErrorBoundary.jsx');
const handler = source.slice(source.indexOf('  handleRetry ='), source.indexOf('  render()'));
function fixture(reloadOnRetry) {
  let reloads = 0, resets = 0, callbacks = 0;
  const instance = new Function('window', 'return new class { ' + handler + ' }')({ location: { reload: () => reloads++ } });
  instance.props = { reloadOnRetry, onRetry: () => callbacks++ };
  instance.setState = () => resets++;
  return { instance, snapshot: () => ({ reloads, resets, callbacks }) };
}
test('顶层错误不自动刷新，只有主动重试才刷新', () => {
  const f = fixture(true);
  assert.deepEqual(f.snapshot(), { reloads: 0, resets: 0, callbacks: 0 });
  f.instance.handleRetry();
  assert.deepEqual(f.snapshot(), { reloads: 1, resets: 0, callbacks: 0 });
});
test('原项目页重试仍重置错误并执行回调，不刷新', () => {
  const f = fixture(false); f.instance.handleRetry();
  assert.deepEqual(f.snapshot(), { reloads: 0, resets: 1, callbacks: 1 });
});
test('加载反馈静态导入且不依赖动画和远程资源', () => {
  const boundary = read('src/components/feedback/AppPageBoundary.jsx');
  assert.match(boundary, /role="status"/);
  assert.match(boundary, /加载中/);
  assert.match(boundary, /reloadOnRetry/);
  assert.doesNotMatch(boundary, /LoadingAnimation|https?:|setTimeout|location.reload/);
});
test('首页和管理台接入，排除入口仍保持原结构', () => {
  const app = read('src/App.jsx');
  assert.match(app, /<AppPageBoundary key="admin">/);
  assert.match(app, /<AppPageBoundary key="home">/);
  assert.match(app, /<SharedCanvasPage token=/);
  assert.ok(app.includes("<CompositionEditorPage />"));
  assert.equal((app.match(/<AppPageBoundary /g) || []).length, 2);
});
