import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readCanvasDocument, serializeCanvasDocument } from '../src/components/canvas/CanvasDocument.js';

async function loadDevelopmentApi() {
  const source = readFileSync(new URL('../src/api/CanvasDevelopment.js', import.meta.url), 'utf8')
    .replaceAll('import.meta.env', '({ DEV: true })');
  return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
}

test('模拟项目首画布、新增、复制及刷新路由均初始化为合法空白文档', async () => {
  const api = await loadDevelopmentApi();
  const first = api.createDevelopmentCanvasProject();
  const next = api.createDevelopmentCanvas({ projectId: first.project_id, title: '画布2' });
  const copy = api.duplicateDevelopmentCanvas(first.id, { title: '副本' });
  const refreshed = api.getDevelopmentCanvas(`dev-canvas-${crypto.randomUUID()}`);
  for (const item of [first, next, copy, refreshed]) {
    assert.deepEqual(item.document, serializeCanvasDocument([]));
    assert.deepEqual(readCanvasDocument(item), {
      nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 },
    });
  }
});

test('修复初始化不放宽未知文档保护，也不覆盖模拟画布已保存内容', async () => {
  const api = await loadDevelopmentApi();
  const first = api.createDevelopmentCanvasProject();
  const document = { unsupported: true };
  api.updateDevelopmentCanvas(first.id, { baseRevision: first.revision, document });
  assert.deepEqual(api.getDevelopmentCanvas(first.id).document, document);
  assert.throws(() => readCanvasDocument(api.getDevelopmentCanvas(first.id)), /文档格式/);
});
