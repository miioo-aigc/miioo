import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createCanvasTextTask } from '../src/components/canvas/CanvasTextTask.js';
import { recoverTextSubmission, readTextHistory, applyTextHistory, isActiveText } from '../src/components/canvas/CanvasDurableText.js';
import * as protocol from '../src/components/canvas/CanvasDurableText.js';
import { createCanvasSaveSession } from '../src/components/canvas/CanvasSaveSession.js';
import { serializeCanvasDocument, readCanvasDocument } from '../src/components/canvas/CanvasDocument.js';
import { copyCanvasNodes } from '../src/components/canvas/CanvasNodeActions.js';
import { planCanvasTextGeneration } from '../src/components/canvas/CanvasTextGeneration.js';
import { canvasDescendantIds } from '../src/components/canvas/CanvasNodeActions.js';
import { createCanvasHistory } from '../src/components/canvas/CanvasHistory.js';
import { createTestViteServer } from './lib/create-test-vite-server.mjs';

const missing = () => Object.assign(new Error('missing'), { status: 404 });
const flush = async () => { for (let i = 0; i < 100; i++) await Promise.resolve(); };
const response = (status = 'queued') => ({ canvas_id: 'canvas', node_id: 'node', client_submission_id: 'submission', task_id: 'task', status });
const node = () => ({ id: 'node', type: 'text', position: { x: 0, y: 0 }, selected: true, data: { content: '原文',
  textSubmission: { clientSubmissionId: 'submission', status: 'preparing', sourceIds: [], prompt: '写作', model: 'model', originalContent: '原文' } } });

test('POST响应丢失后查询原UUID，不重复创建', async () => {
  let gets = 0, posts = 0;
  const result = await recoverTextSubmission({ preparing: true, body: { client_submission_id: 'stable' },
    get: async () => { if (++gets === 1) throw missing(); return response(); },
    post: async () => { posts++; throw new TypeError('network'); } });
  assert.equal(result.status, 'queued'); assert.equal(posts, 1); assert.equal(gets, 2);
});
test('确认404只用原请求体重发一次，queued 404禁止提交', async () => {
  const body = { client_submission_id: 'stable', expected_version: 3 };
  let posts = 0;
  await assert.rejects(recoverTextSubmission({ preparing: true, body, get: async () => { throw missing(); },
    post: async (actual) => { assert.equal(actual, body); posts++; throw new TypeError('network'); } }), { status: 404 });
  assert.equal(posts, 2);
  await assert.rejects(recoverTextSubmission({ preparing: false, body, get: async () => { throw missing(); },
    post: async () => { posts++; } }), { status: 404 });
  assert.equal(posts, 2);
});
test('503和幂等冲突不自动重试', async () => {
  for (const status of [409, 503]) {
    let posts = 0;
    await assert.rejects(recoverTextSubmission({ preparing: true, body: {}, get: async () => { throw missing(); },
      post: async () => { posts++; throw Object.assign(new Error('stop'), { status }); } }), { status });
    assert.equal(posts, 1);
  }
});
test('串行轮询、隐藏暂停、四个终态都停止，未知结果不重投', async () => {
  for (const terminal of ['completed', 'failed', 'cancelled', 'outcome_unknown']) {
    let hidden = true, gets = 0, finished;
    const jobs = [];
    const task = createCanvasTextTask({ canvasId: 'canvas', nodeId: 'node', id: 'submission',
      getSubmission: () => node().data.textSubmission, isCurrent: () => true, hidden: () => hidden,
      schedule: (fn) => { jobs.push(fn); return fn; }, unschedule: () => {},
      api: { get: async () => response(++gets === 1 ? 'running' : terminal), post: () => assert.fail('no post') },
      active: () => {}, prepare: () => assert.fail('no prepare'), finish: (value) => { finished = value.status; }, report: assert.fail });
    await task.start(); assert.equal(gets, 0);
    hidden = false; await jobs.shift()(); assert.equal(gets, 1);
    await jobs.shift()(); assert.equal(finished, terminal); assert.equal(jobs.length, 0);
    task.dispose();
  }
});
test('取消意图可先于提交：等待准备收口后不再POST', async () => {
  let release, prepares = 0, posts = 0, finished;
  const task = createCanvasTextTask({ canvasId: 'canvas', nodeId: 'node', id: 'submission',
    getSubmission: () => node().data.textSubmission, isCurrent: () => true, hidden: () => false,
    api: { get: async () => { throw missing(); }, post: async () => { posts++; }, cancel: async () => response('cancelled') },
    prepare: () => { prepares++; return new Promise((resolve) => { release = resolve; }); },
    active: assert.fail, finish: (value) => { finished = value.status; }, report: assert.fail });
  task.start(); await flush(); assert.equal(prepares, 1);
  const cancelled = task.cancel(); await flush(); release(); await cancelled;
  assert.equal(posts, 0); assert.equal(finished, 'cancelled'); task.dispose();
});
test('刷新只终止本地请求，取消遇到完成则取完成结果', async () => {
  let cancelled = 0, finished;
  const make = () => createCanvasTextTask({ canvasId: 'canvas', nodeId: 'node', id: 'submission',
    getSubmission: () => node().data.textSubmission, isCurrent: () => true, hidden: () => false,
    api: { cancel: async () => { cancelled++; return response('completed'); } },
    finish: (value) => { finished = value.status; }, report: assert.fail });
  make().dispose(); assert.equal(cancelled, 0);
  const task = make(); await task.cancel(); assert.equal(finished, 'completed'); task.dispose();
});
test('任务身份随文档恢复，复制和撤销不恢复运行身份', () => {
  const original = node();
  const restored = readCanvasDocument(serializeCanvasDocument([original])).nodes[0];
  assert.equal(restored.data.textSubmission.clientSubmissionId, 'submission'); assert.ok(isActiveText(restored));
  assert.equal(copyCanvasNodes([original])[0].data.textSubmission, undefined);
  const history = createCanvasHistory([original]); history.setNodes([]); history.undo();
  assert.equal(history.getSnapshot().nodes[0].data.textSubmission, undefined);
});
const batch = (id, content, sequence) => ({ id, sequence, source: 'generation', request_count: 1,
  submitted_at: '2026-11-13T00:00:00Z', completed_at: '2026-11-13T00:00:01Z', task_ids: ['task'], input_snapshot: {},
  results: [{ id: id + '-result', index: 0, type: 'text', assetId: null, content }] });
test('历史翻页并按服务端current回填，不把本次旧任务覆盖到新定稿', async () => {
  const page = await readTextHistory(async (cursor) => ({ items: [cursor ? batch('old', '旧生成', 1) : batch('new', '新定稿', 2)],
    current_result_id: 'new-result', output_version: 2, revision: 8, next_cursor: cursor ? null : '1' }));
  assert.equal(page.items.length, 2);
  assert.equal(applyTextHistory(node(), page).data.content, '新定稿');
  await assert.rejects(readTextHistory(async () => ({ ...page, next_cursor: '1' })), /游标重复/);
});
test('历史写入和PATCH串行，服务端mutation推进保存基线', async () => {
  const calls = [];
  const session = createCanvasSaveSession(async (_, body) => { calls.push(body.baseRevision); return { revision: body.baseRevision + 1 }; }, () => 'id');
  await session.save('canvas', 1, {});
  await session.mutate(async (accept) => accept(8));
  await session.save('canvas', 2, { changed: true });
  assert.deepEqual(calls, [1, 8]);
});
test('实际hook：保存提交身份和历史操作后才POST，使用节点output_version', async () => {
  const source = readFileSync(new URL('../src/components/canvas/UseCanvasTextGeneration.js', import.meta.url), 'utf8');
  const body = source.slice(source.indexOf('export function')).replace('export function', 'function');
  let nodes = [{ ...node(), data: { content: '原文' } }], saved;
  const events = [], effects = [], messages = [];
  const page = { items: [batch('existing', '原文', 1)], current_result_id: 'existing-result', output_version: 7, revision: 20, next_cursor: null };
  const fakeApi = { apiGetCanvasTextSubmission: async () => { throw missing(); },
    apiGetCanvasTextBatches: async () => page, apiSubmitCanvasText: async (_, nodeId, request) => {
      events.push('post'); assert.equal(request.expected_version, 7);
      assert.deepEqual(saved[0].data.textSubmission.request, request);
      return { ...response('outcome_unknown'), node_id: nodeId, client_submission_id: request.client_submission_id };
    } };
  const bridge = { current: { ready: true, getNodes: () => nodes, persist: async () => {
    events.push('save'); saved = structuredClone(nodes); return true;
  }, mutate: (fn) => fn(() => {}) } };
  const deps = { ...protocol, api: fakeApi, useRef: (value) => ({ current: value }), useEffect: (fn) => effects.push(fn),
    useCallback: (fn) => fn, getAuthSessionGeneration: () => 1, showGlobalToast: (...args) => messages.push(args),
    planCanvasTextGeneration, canvasDescendantIds, createCanvasTextTask: (options) => createCanvasTextTask({ ...options, hidden: () => false }) };
  const hook = new Function(...Object.keys(deps), body + ';return useCanvasTextGeneration;')(...Object.values(deps));
  const actions = hook(nodes, (update) => { nodes = update(nodes); }, 'canvas', () => {}, bridge);
  const cleanup = effects[0]();
  await actions.generate({ nodeId: 'node', prompt: '写作', model: 'model' }); await flush();
  assert.equal(events.filter((event) => event === 'post').length, 1); assert.equal(events[0], 'save');
  assert.equal(nodes[0].data.textSubmission.status, 'outcome_unknown'); assert.equal(nodes[0].data.generating, false);
  assert.ok(messages.some(([message]) => message.includes('可能已产生费用'))); cleanup();
});
test('API专用路径编码及嵌套错误解析', async () => {
  const server = await createTestViteServer(); const previous = { fetch: globalThis.fetch, localStorage: globalThis.localStorage };
  try {
    globalThis.localStorage = { getItem: () => 'test-token' };
    const api = await server.ssrLoadModule('/src/api/CanvasTextSubmissions.js');
    globalThis.fetch = async (url, options) => {
      assert.ok(url.includes('/nodes/a%2Fb/text-submissions/id/cancel')); assert.equal(options.method, 'POST');
      return new Response(JSON.stringify({ detail: { code: 'CANVAS_NODE_VERSION_CONFLICT', message: '版本冲突' } }), { status: 409 });
    };
    await assert.rejects(api.apiCancelCanvasTextSubmission('canvas', 'a/b', 'id'), { status: 409, code: 'CANVAS_NODE_VERSION_CONFLICT' });
  } finally { Object.assign(globalThis, previous); await server.close(); }
});
