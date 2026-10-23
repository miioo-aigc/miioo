import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { SourceTextModule, SyntheticModule } from 'node:vm';
import { transformWithOxc } from 'vite';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as jsxRuntime from 'react/jsx-runtime';

const source = readFileSync(new URL('../src/components/feedback/RemoteReadStatus.jsx', import.meta.url), 'utf8');
const transformed = await transformWithOxc(source, 'RemoteReadStatus.jsx', { jsx: { runtime: 'automatic' } });
const module = new SourceTextModule(transformed.code);
await module.link((name) => {
  const exports = name === 'react/jsx-runtime' ? jsxRuntime : {
    Button: ({ children, onClick }) => createElement('button', { onClick }, children),
  };
  assert.ok(['react/jsx-runtime', '../ui'].includes(name));
  return new SyntheticModule(Object.keys(exports), function () {
    for (const [key, value] of Object.entries(exports)) this.setExport(key, value);
  });
});
await module.evaluate();
const render = (props) => renderToStaticMarkup(createElement(module.namespace.default, props));

test('成功读取不输出加载或错误提示', () => {
  assert.equal(render({}), '');
});
test('等待时优先显示读取状态，不显示旧错误与重试按钮', () => {
  const html = render({ loading: true, error: '旧错误', onRetry() {} });
  assert.match(html, /role="status"/);
  assert.doesNotMatch(html, /旧错误|<button/);
});
test('读取失败显示错误和显式重试入口', () => {
  const html = render({ error: '读取失败', onRetry() {} });
  assert.match(html, /role="alert"/);
  assert.match(html, /读取失败/);
  assert.match(html, /<button>重试<\/button>/);
});
