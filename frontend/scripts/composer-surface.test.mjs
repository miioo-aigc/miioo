import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { after, test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

const server = await createServer({
  server: { middlewareMode: true, hmr: false, watch: null },
  optimizeDeps: { noDiscovery: true, include: [] },
  appType: 'custom',
});
const { default: ComposerSurface } = await server.ssrLoadModule('/src/components/ui/ComposerSurface.jsx');
after(() => server.close());

test('聚焦保留 Beam 并暂停全部动效层，不再显示品牌色描边', async () => {
  const html = renderToStaticMarkup(createElement(ComposerSurface, { focused: true }, '内容'));
  assert.match(html, /data-focused="true"/);
  assert.match(html, /data-active=""/);
  const css = await readFile(new URL('../src/components/ui/ComposerSurface.css', import.meta.url), 'utf8');
  for (const suffix of ['', '::before', '::after', ' > [data-beam-bloom]']) {
    assert.ok(css.includes(`.composer-surface[data-focused='true']${suffix}`));
  }
  assert.match(css, /animation-play-state: paused !important/);
  assert.doesNotMatch(css, /background: var\(--color-brand-main\)/);
});

test('公共输入外壳默认渲染 Beam 并保留编辑区、工具栏和尺寸', () => {
  const html = renderToStaticMarkup(createElement(ComposerSurface, {
    width: '800px', stretch: true, toolbar: createElement('button', null, '发送'),
  }, createElement('textarea', { defaultValue: '提示词' })));
  assert.match(html, /data-beam=/);
  assert.match(html, /data-active=""/);
  assert.match(html, /--beam-strength:0.7/);
  assert.match(html, /width:800px/);
  assert.match(html, /data-stretch="true"/);
  assert.match(html, /<textarea>提示词<\/textarea>/);
  assert.match(html, /<button>发送<\/button>/);
});

test('禁用时不启动 Beam 且保留独立的淡化配置', () => {
  const html = renderToStaticMarkup(createElement(ComposerSurface, {
    disabled: true, dimmed: false,
  }, '内容'));
  assert.match(html, /data-beam=/);
  assert.doesNotMatch(html, /data-active=""/);
  assert.match(html, /data-dimmed="false"/);
});
