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

test('复制保留节点连线分组与视口，内容独立且不复制运行状态', () => {
  const first = api.createDevelopmentCanvasProject();
  const document = { nodes: [{ id: 'image-1', parentId: 'group-1', data: { generating: true, generationRequestId: 'run-1', asset: { asset_id: 'asset-1' } } }], edges: [{ id: 'edge-1' }], viewport: { x: 10, y: 20, zoom: 0.8 } };
  api.updateDevelopmentCanvas(first.id, { baseRevision: 1, document });
  const copy = api.duplicateDevelopmentCanvas(first.id, { title: '画布1 副本' });
  assert.notEqual(copy.id, first.id);
  assert.equal(copy.project_id, first.project_id);
  assert.equal(copy.document.nodes[0].parentId, 'group-1');
  assert.equal(copy.document.nodes[0].data.generating, undefined);
  assert.equal(copy.document.nodes[0].data.generationRequestId, undefined);
  assert.deepEqual(copy.document.edges, document.edges);
  assert.deepEqual(copy.document.viewport, document.viewport);
  copy.document.nodes[0].data.asset.asset_id = 'changed';
  assert.equal(api.getDevelopmentCanvas(first.id).document.nodes[0].data.asset.asset_id, 'asset-1');
  assert.equal(api.getDevelopmentCanvas(first.id).document.nodes[0].data.generating, true);
});

test('删除只移除指定画布，不影响同项目其他画布，旧地址不复活', () => {
  const first = api.createDevelopmentCanvasProject();
  const second = api.createDevelopmentCanvas({ projectId: first.project_id, title: '画布2' });
  api.archiveDevelopmentCanvas(first.id);
  assert.deepEqual(api.listDevelopmentCanvases(first.project_id).map((item) => item.id), [second.id]);
  assert.throws(() => api.getDevelopmentCanvas(first.id), /已删除/);
  assert.throws(() => api.archiveDevelopmentCanvas(first.id), /已删除/);
  api.archiveDevelopmentCanvas(second.id);
  assert.deepEqual(api.listDevelopmentCanvases(first.project_id), []);
});

test('画布删除动作拦截最后一个画布，多个画布时允许删除并切换', async () => {
  const hookSource = await readFile(new URL('../src/components/canvas/UseCanvasList.js', import.meta.url), 'utf8');
  for (const count of [1, 2]) {
    const items = Array.from({ length: count }, (_, index) => ({ id: `canvas-${index}`, project_id: 'project-1' }));
    const archived = [];
    const selected = [];
    const toasts = [];
    const states = [items, true, false];
    const dependencies = {
      useEffect: () => {},
      useRef: (current) => ({ current }),
      useState: () => [states.shift(), () => {}],
      apiArchiveCanvasDocument: async (id) => { archived.push(id); },
      showGlobalToast: (...args) => { toasts.push(args); },
    };
    const createHook = new Function(...Object.keys(dependencies), `${hookSource.replace(/^import .*;\n/gm, '').replace('export function', 'function')}\nreturn useCanvasList;`);
    const hook = createHook(...Object.values(dependencies))({
      canvas: items[0], persistCanvas: async () => true,
      onSelectCanvas: (id) => selected.push(id),
      onBackProjects: () => assert.fail('不应删除最后一个画布并返回项目列表'),
    });
    assert.equal(await hook.remove(items[0].id), count > 1);
    assert.deepEqual(archived, count > 1 ? [items[0].id] : []);
    assert.deepEqual(selected, count > 1 ? [items[1].id] : []);
    assert.deepEqual(toasts, count > 1 ? [['success', '画布已删除']] : [['error', '项目至少需要保留一个画布']]);
  }
});
