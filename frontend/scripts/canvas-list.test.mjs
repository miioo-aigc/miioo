import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import test from 'node:test';

const source = await readFile(new URL('../src/api/CanvasDevelopment.js', import.meta.url), 'utf8');
const api = await import(`data:text/javascript,${encodeURIComponent(source.replace("import.meta.env?.DEV === true", 'true').replace("import.meta.env?.VITE_CANVAS_DEV_MOCK", 'undefined'))}`);

test('同项目新增画布保留旧画布，不混入其他项目，也不重复项目列表', () => {
  const first = api.createDevelopmentCanvasProject();
  const other = api.createDevelopmentCanvasProject();
  const second = api.createDevelopmentCanvas({ projectId: first.project_id, title: '画布2' });
  assert.deepEqual(api.listDevelopmentCanvases(first.project_id).map((item) => item.id), [first.id, second.id]);
  assert.equal(api.listDevelopmentCanvases(other.project_id).length, 1);
  assert.equal(api.listDevelopmentCanvasProjects().length, 2);
});

test('内容、视口与重命名在切换后保留，旧版本保存被拒绝', () => {
  const first = api.createDevelopmentCanvasProject();
  const document = { nodes: [{ id: 'text-1', data: { content: '正文' } }], viewport: { x: 20, y: 30, zoom: 0.5 } };
  api.updateDevelopmentCanvas(first.id, { baseRevision: 1, document });
  const result = api.updateDevelopmentCanvas(first.id, { baseRevision: 2, title: '故事板' });
  assert.equal(result.revision, 3);
  assert.deepEqual(api.getDevelopmentCanvas(first.id).document, document);
  assert.equal(api.getDevelopmentCanvas(first.id).title, '故事板');
  assert.throws(() => api.updateDevelopmentCanvas(first.id, { baseRevision: 1, title: '旧名称' }));
});
