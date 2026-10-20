import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { throwResponseError } from '../src/api/error.js';

const source = readFileSync(new URL('../src/api/canvas.js', import.meta.url), 'utf8')
  .replace(/^import .*;\n/gm, '')
  .replace('import.meta.env.VITE_API_BASE_URL', '"https://api.example.test"')
  .replace(/export /g, '');

function setup({ status = 200, payload = { ok: true } } = {}) {
  const calls = [];
  const request = (kind) => async (url, options) => {
    calls.push({ kind, url, options });
    return new Response(status === 204 ? null : JSON.stringify(payload), { status, headers: { 'content-type': 'application/json' } });
  };
  const api = runInNewContext(`${source}\n({ apiResolveCanvasAssetViews, apiArchiveCanvasDocument, apiDuplicateCanvasDocument,
    apiGetCanvasShareStatus, apiEnableCanvasShare, apiDisableCanvasShare,
    apiGetSharedCanvas, apiImportSharedCanvas, apiUpdateCanvasDocument, apiReorderCanvasDocuments,
    apiGetCanvasRuns, apiGetCanvasRun, apiCancelCanvasRun, apiReconcileCanvasRuns })`, {
    authFetch: request('auth'), fetch: request('public'), throwResponseError,
    isDevelopmentCanvas: (id) => id.startsWith('dev-'), URLSearchParams,
  });
  return { api, calls };
}

test('资产解析去重保序，保留失效分类，不修改返回结构', async () => {
  const payload = { items: [], missing_ids: ['a'], forbidden_ids: ['b'] };
  const { api, calls } = setup({ payload });
  assert.deepEqual(await api.apiResolveCanvasAssetViews('canvas', ['a', 'b', 'a']), payload);
  assert.deepEqual(JSON.parse(calls[0].options.body), { asset_ids: ['a', 'b'] });
  assert.equal(calls[0].kind, 'auth');
  assert.throws(() => api.apiResolveCanvasAssetViews('canvas', Array.from({ length: 201 }, (_, i) => String(i))), /200/);
  assert.throws(() => api.apiResolveCanvasAssetViews('canvas', [null]), /资产编号/);
  assert.equal(calls.length, 1);
});

test('保存和分享导入携带各自幂等键，204删除无需解析JSON', async () => {
  const { api, calls } = setup();
  await api.apiUpdateCanvasDocument('id', { baseRevision: 0, document: {}, clientSaveId: 'save-1' });
  assert.deepEqual(JSON.parse(calls[0].options.body), { base_revision: 0, document: {}, client_save_id: 'save-1' });
  await api.apiImportSharedCanvas('token', { clientRequestId: 'import-1' });
  assert.deepEqual(JSON.parse(calls[1].options.body), { client_request_id: 'import-1' });
  assert.equal(await setup({ status: 204 }).api.apiArchiveCanvasDocument('id'), null);
});

test('任务读取、取消与只读对账使用独立接口，透传取消信号', async () => {
  const { api, calls } = setup();
  const signal = new AbortController().signal;
  await api.apiGetCanvasRuns('id/a', { status: 'running', limit: 100, signal });
  await api.apiGetCanvasRun('id/a', 'run/a');
  await api.apiCancelCanvasRun('id/a', 'run/a');
  await api.apiReconcileCanvasRuns('id/a');
  assert.ok(calls[0].url.endsWith('/id%2Fa/runs?limit=100&status=running'));
  assert.equal(calls[0].options.signal, signal);
  assert.ok(calls[1].url.endsWith('/runs/run%2Fa'));
  assert.ok(calls[2].url.endsWith('/runs/run%2Fa/cancel'));
  assert.ok(calls[3].url.endsWith('/runs/reconcile'));
  assert.deepEqual(calls.map((call) => call.options.method), ['GET', 'GET', 'POST', 'POST']);
  assert.throws(() => api.apiGetCanvasRuns('id', { limit: 101 }), /1至100/);
});

test('分享状态、启用、关闭及归档使用独立画布路径和正确动词', async () => {
  const { api, calls } = setup();
  await api.apiGetCanvasShareStatus('id/a');
  await api.apiEnableCanvasShare('id/a');
  await api.apiDisableCanvasShare('id/a');
  await api.apiArchiveCanvasDocument('id/a');
  assert.deepEqual(calls.map(({ options }) => options.method), ['GET', 'POST', 'DELETE', 'DELETE']);
  assert.ok(calls.every(({ kind, url }) => kind === 'auth' && url.includes('/id%2Fa')));
  assert.ok(calls.slice(0, 3).every(({ url }) => url.endsWith('/share')));
});

test('复制使用专用接口和幂等键，由服务端复制快照而非携带运行任务', async () => {
  const { api, calls } = setup({ payload: { id: 'copy' } });
  assert.equal((await api.apiDuplicateCanvasDocument('id/a', { title: '副本', clientRequestId: 'request-1' })).id, 'copy');
  assert.ok(calls[0].url.endsWith('/id%2Fa/duplicate'));
  assert.equal(calls[0].options.method, 'POST');
  assert.deepEqual(JSON.parse(calls[0].options.body), { title: '副本', client_request_id: 'request-1' });
});

test('公开读取无登录凭证，导入需登录且不自动重试', async () => {
  const { api, calls } = setup();
  const controller = new AbortController();
  await api.apiGetSharedCanvas('token/a', { signal: controller.signal });
  await api.apiImportSharedCanvas('token/a');
  assert.equal(calls[0].kind, 'public');
  assert.equal(calls[0].options.credentials, 'omit');
  assert.equal(calls[0].options.signal, controller.signal);
  assert.ok(calls[0].url.endsWith('/token%2Fa'));
  assert.equal(calls[1].kind, 'auth');
  assert.equal(calls[1].options.method, 'POST');
  assert.ok(calls[1].url.endsWith('/token%2Fa/import'));
  await assert.rejects(api.apiGetSharedCanvas(''), /凭证/);
});

test('结构化冲突保留版本与错误码，字符串错误保留中文信息', async () => {
  const { api } = setup({ status: 409, payload: { detail: {
    code: 'CANVAS_REVISION_CONFLICT', message: '版本冲突', current_revision: 8,
  } } });
  await assert.rejects(api.apiUpdateCanvasDocument('canvas', { baseRevision: 1, title: '名称' }), (error) => {
    assert.equal(error.status, 409);
    assert.equal(error.code, 'CANVAS_REVISION_CONFLICT');
    assert.equal(error.detail.current_revision, 8);
    return true;
  });
  const missing = setup({ status: 404, payload: { detail: '画布不存在' } });
  await assert.rejects(missing.api.apiGetCanvasShareStatus('canvas'), /画布不存在/);
});

test('模拟画布不泄漏到真实接口', async () => {
  const { api, calls } = setup();
  await assert.rejects(api.apiEnableCanvasShare('dev-local'), /模拟画布不支持/);
  assert.equal(calls.length, 0);
});

const canvasA = '10000000-0000-0000-0000-000000000001';
const canvasB = '10000000-0000-0000-0000-000000000002';

test('排序显式传递作用域与顺序，返回稀疏元数据，不伪造完整目录', async () => {
  const payload = { project_id: canvasA, parent_canvas_id: null, items: [{ id: canvasB, sort_order: 0 }] };
  const { api, calls } = setup({ payload });
  const signal = new AbortController().signal;
  assert.deepEqual(await api.apiReorderCanvasDocuments({ projectId: canvasA, orderedCanvasIds: [canvasB], signal }), payload);
  assert.ok(calls[0].url.endsWith('/api/canvas-documents/reorder'));
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(calls[0].options.signal, signal);
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    project_id: canvasA, parent_canvas_id: null, ordered_canvas_ids: [canvasB],
  });
  await api.apiReorderCanvasDocuments({ parentCanvasId: canvasB, orderedCanvasIds: [canvasA] });
  assert.equal(JSON.parse(calls[1].options.body).parent_canvas_id, canvasB);
  await api.apiReorderCanvasDocuments({ orderedCanvasIds: [canvasA] });
  assert.equal(JSON.parse(calls[2].options.body).project_id, null);
});

test('排序拒绝模拟、重复、空编号，422保留后端错误码与越界编号', async () => {
  const { api, calls } = setup();
  for (const args of [
    { orderedCanvasIds: [] }, { orderedCanvasIds: [canvasA, canvasA] },
    { orderedCanvasIds: ['dev-canvas-a'] }, { projectId: 'dev-project-a', orderedCanvasIds: [canvasA] },
  ]) await assert.rejects(api.apiReorderCanvasDocuments(args));
  assert.equal(calls.length, 0);
  const failed = setup({ status: 422, payload: { detail: {
    code: 'CANVAS_REORDER_INVALID', message: '画布超出作用域', invalid_canvas_ids: [canvasB],
  } } });
  await assert.rejects(failed.api.apiReorderCanvasDocuments({ orderedCanvasIds: [canvasB] }), (error) => {
    assert.equal(error.code, 'CANVAS_REORDER_INVALID');
    assert.deepEqual(error.detail.invalid_canvas_ids, [canvasB]);
    return true;
  });
});

test('同作用域排序等待前次响应，失败不阻断下次，不同作用域独立', async () => {
  let release;
  const wait = new Promise((resolve) => { release = resolve; });
  const calls = [];
  const { apiReorderCanvasDocuments: reorder } = runInNewContext(`${source}\n({apiReorderCanvasDocuments})`, {
    authFetch: async (url, options) => {
      calls.push(JSON.parse(options.body));
      if (calls.length === 1) { await wait; return new Response('{}', { status: 500 }); }
      return new Response('{}');
    }, throwResponseError,
  });
  const first = assert.rejects(reorder({ orderedCanvasIds: [canvasA] }));
  const second = reorder({ orderedCanvasIds: [canvasB] });
  await reorder({ projectId: canvasA, orderedCanvasIds: [canvasB] });
  assert.equal(calls.length, 2);
  release();
  await first;
  await second;
  assert.equal(calls.length, 3);
  assert.deepEqual(calls[2].ordered_canvas_ids, [canvasB]);
});

test('等待中的排序取消后不再提交', async () => {
  const { api, calls } = setup();
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(api.apiReorderCanvasDocuments({ orderedCanvasIds: [canvasA], signal: controller.signal }), { name: 'AbortError' });
  assert.equal(calls.length, 0);
});
