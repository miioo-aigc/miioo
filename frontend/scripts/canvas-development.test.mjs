import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/api/CanvasDevelopment.js', import.meta.url), 'utf8');
async function load(env) {
  const code = source.replaceAll('import.meta.env', JSON.stringify(env));
  return import(`data:text/javascript,${encodeURIComponent(`${code}\n// ${crypto.randomUUID()}`)}`);
}

test('开发态无需后端即可新建、列表读取和详情读取，项目彼此隔离', async () => {
  const api = await load({ DEV: true });
  const first = api.createDevelopmentCanvasProject();
  const second = api.createDevelopmentCanvasProject();
  assert.notEqual(first.id, second.id);
  assert.notEqual(first.project_id, second.project_id);
  assert.equal(first.title, '画布1');
  assert.equal(api.listDevelopmentCanvasProjects().length, 2);
  first.project_name = '外部修改';
  assert.equal(api.getDevelopmentCanvas(first.id).project_name, '未命名项目');
  assert.equal(api.isDevelopmentCanvas('real-id'), false);
});

test('刷新清空内存后，原模拟路由可重新打开空白草稿', async () => {
  const before = await load({ DEV: true });
  const created = before.createDevelopmentCanvasProject();
  const after = await load({ DEV: true });
  assert.deepEqual(after.listDevelopmentCanvasProjects(), []);
  assert.equal(after.getDevelopmentCanvas(created.id).id, created.id);
});

test('生产环境和显式关闭开关时禁止模拟创建与模拟详情', async () => {
  for (const env of [{ DEV: false }, { DEV: false, VITE_CANVAS_DEV_MOCK: 'true' }, { DEV: true, VITE_CANVAS_DEV_MOCK: 'false' }]) {
    const api = await load(env);
    assert.equal(api.canvasDevelopmentEnabled, false);
    assert.equal(api.isDevelopmentCanvas('dev-canvas-test'), false);
    assert.deepEqual(api.listDevelopmentCanvasProjects(), []);
    assert.throws(() => api.createDevelopmentCanvasProject(), /仅开发环境/);
    assert.throws(() => api.getDevelopmentCanvas('dev-canvas-test'), /不是开发态/);
  }
});

test('新建菜单显式接线，画布按编号重建以隔离节点和历史', async () => {
  const home = await readFile(new URL('../src/pages/Home.jsx', import.meta.url), 'utf8');
  const page = await readFile(new URL('../src/pages/CanvasPage.jsx', import.meta.url), 'utf8');
  const header = await readFile(new URL('../src/components/canvas/CanvasProjectHeader.jsx', import.meta.url), 'utf8');
  assert.match(home, /<CanvasPage key=\{canvasRouteId\}/);
  assert.ok(home.includes('onCreateProject={handleCreateCanvas}'));
  assert.match(page, /onCreateProject=\{onCreateProject\}/);
  assert.match(page, /isDevelopmentCanvas\(canvasId\) \? Promise.resolve\(\{\}\) : apiGetCurrentUser\(\)/);
  assert.match(header, /onClick: onCreateProject \|\| onUnsupported/);
});
