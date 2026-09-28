import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readCanvasTextFile } from '../src/components/canvas/CanvasTextFileReader.js';

test('文档解析器在开发服务启动时预构建，避免首次上传才发现依赖', () => {
  const config = readFileSync(new URL('../vite.config.js', import.meta.url), 'utf8');
  assert.match(config, /optimizeDeps:\s*\{\s*include:\s*\['mammoth'\]/);
});

test('文件选择不使用系统格式预筛选，错误在节点内展示', () => {
  const source = readFileSync(new URL('../src/components/canvas/TextCanvasNode.jsx', import.meta.url), 'utf8');
  const input = source.match(/<input\b[^>]*type="file"[^>]*\/>/)?.[0];
  assert.ok(input);
  assert.doesNotMatch(input, /accept=/);
  assert.match(source, /role="alert"/);
  assert.match(source, /setFileError\(/);
});

test('文本和 Markdown 正文原样读取，不支持的文件仍被拒绝', async () => {
  for (const name of ['scene.txt', 'scene.md']) {
    assert.equal(await readCanvasTextFile(new File(['第一场\n室内'], name)), '第一场\n室内');
  }
  await assert.rejects(readCanvasTextFile(new File(['内容'], 'scene.pdf')), /仅支持/);
});
