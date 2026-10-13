import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../src/components/assets/AssetsCards.jsx', import.meta.url), 'utf8');

test('分镜编辑结果不再作为外层独立图片卡片渲染', () => {
  assert.match(
    source,
    /!isStoryboard\s*&&\s*!isSubject\s*&&\s*edits\.images\.map\(\(image\)\s*=>\s*<CreationImageResultCard/,
  );
});

test('分镜编辑结果仍合并进详情弹窗的候选图片', () => {
  assert.match(source, /: \[\.\.\.\(asset\.images \?\? \[\]\), \.\.\.edits\.images\];/);
  assert.match(source, /<ProjectAssetDetail[\s\S]*images=\{images\}/);
});

test('主体与分镜以外的资产仍保留独立编辑结果卡片', () => {
  const resultCardRender = source.match(/!isStoryboard\s*&&\s*!isSubject\s*&&\s*edits\.images\.map\(\(image\)\s*=>\s*<CreationImageResultCard[\s\S]*?\n\s*\{angleResults\.results\.map/);
  assert.ok(resultCardRender, '应保留其他资产的编辑结果卡片渲染');
});
