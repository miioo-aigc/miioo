import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('画布与创作上传入口共用素材菜单', () => {
  for (const path of ['src/components/canvas/CanvasReferenceBar.jsx', 'src/components/creation/CreationUploadArea.jsx']) {
    assert.match(read(path), /<CreationUploadMenu\b/);
  }
  const menu = read('src/components/creation/CreationUploadMenu.jsx');
  assert.ok(menu.indexOf('label="从资产库选择"') < menu.indexOf('label="从本地上传"'));
  assert.match(menu, /bottom: 'calc\(100% \+ 8px\)'/);
});

test('参考图添加按钮悬停使用中性增强描边', () => {
  const css = read('src/components/canvas/canvas-nodes.css');
  assert.match(css, /button\.canvas-reference-bar__slot:hover[^{}]*\{[^}]*border-color: var\(--color-stroke-accent\)/);
});
