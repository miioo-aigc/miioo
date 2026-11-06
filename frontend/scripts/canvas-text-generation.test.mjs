import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createCanvasTextRequests } from '../src/components/canvas/CanvasTextRequests.js';
import { createTestViteServer } from './lib/create-test-vite-server.mjs';
import { createCanvasNode } from '../src/components/canvas/canvasNodeUtils.js';
import { connectCanvasText, disconnectCanvasText, isCanvasTextConnection, getCanvasTextEdges,
  planCanvasTextGeneration, beginCanvasTextGeneration, applyCanvasTextResult, recoverCanvasTextGenerationFailure,
} from '../src/components/canvas/CanvasTextGeneration.js';
const text = (id, content = '', sources = []) => ({ ...createCanvasNode('text', { x: 100, y: 200 }, id),
  data: { content, textSourceIds: sources, prompt: '草稿' } });

test('文本起始使用最新节点状态拒绝并发及其他提交任务的上游保护', () => {
  const nodes = [text('a', '正文')];
  const plan = planCanvasTextGeneration(nodes, 'a', '创作', 'model');
  for (const flag of ['generating', 'submissionLocked']) {
    const current = [{ ...nodes[0], data: { ...nodes[0].data, [flag]: true } }];
    assert.throws(() => beginCanvasTextGeneration(current, plan), /正在提交或生成/);
  }
  const locked = { id: 'other', data: { submissionLocked: true, executionSourceIds: ['a'] } };
  assert.throws(() => beginCanvasTextGeneration([...nodes, locked], plan), /上游保护/);
  assert.doesNotThrow(() => beginCanvasTextGeneration([...nodes, { ...locked, data: { ...locked.data, submissionLocked: false } }], plan));
  assert.throws(() => beginCanvasTextGeneration([], plan), /已不存在/);
  const running = beginCanvasTextGeneration(nodes, plan);
  assert.throws(() => beginCanvasTextGeneration(running, plan), /正在提交或生成/);
});

for (const type of ['Text', 'Video']) test(type + '实际提交入口起始竞态失败时中止并释放登记，不发真实请求', async () => {
  const generation = await import('../src/components/canvas/Canvas' + type + 'Generation.js');
  const source = readFileSync(new URL('../src/components/canvas/UseCanvas' + type + 'Generation.js', import.meta.url), 'utf8');
  const hookName = 'useCanvas' + type + 'Generation';
  const body = source.slice(source.indexOf('export function ' + hookName)).replace('export function', 'function');
  const target = type === 'Text' ? text('target', '旧正文') : createCanvasNode('video', undefined, 'target');
  const captured = [target];
  const requests = createCanvasTextRequests();
  let controller;
  const start = requests.start;
  requests.start = (plan) => { controller = start(plan); return controller; };
  let calls = 0;
  const toasts = [];
  const dependencies = {
    ...generation, useCallback: (fn) => fn, useEffect: () => {}, useState: () => [requests],
    createCanvasTextRequests, showGlobalToast: (message) => toasts.push(message),
    apiGenerateCanvasText: async () => { calls++; return '不应调用'; },
    apiGenerateCreation: async () => { calls++; return {}; },
    createCanvasProgressHandler: () => () => {},
  };
  const factory = new Function(...Object.keys(dependencies), body + '; return ' + hookName);
  const hook = factory(...Object.values(dependencies));
  const latest = [{ ...target, data: { ...target.data, generating: true, generationRequestId: 'other-request' } }];
  const setNodes = (update) => update(latest);
  const submit = type === 'Text' ? hook(captured, setNodes, 'canvas', () => {}) : hook(captured, setNodes, () => {});
  await submit({ nodeId: 'target', prompt: '创作', model: 'model', generationMode: 'text_to_video',
    capabilities: { supported_generation_modes: ['text_to_video'], generation_reference_mode_map: { text_to_video: null } } });
  assert.equal(calls, 0);
  assert.equal(requests.size, 0);
  assert.equal(controller.signal.aborted, true);
  assert.match(toasts[0], /正在提交或生成/);
  assert.equal(latest[0].data.generationRequestId, 'other-request');
});

test('文本连接类型、方向及重复连接保持原规则', () => {
  const nodes = [text('a'), text('b'), createCanvasNode('image', undefined, 'image')];
  assert.equal(isCanvasTextConnection(nodes, { source: 'image', target: 'b' }), false);
  assert.equal(isCanvasTextConnection(nodes, { source: 'b', target: 'b' }), false);
  assert.equal(isCanvasTextConnection(nodes, { source: 'a', target: 'b', targetHandle: 'audio-input' }), false);
  const linked = connectCanvasText(nodes, { source: 'a', target: 'b' });
  assert.equal(getCanvasTextEdges(connectCanvasText(linked, { source: 'a', target: 'b' })).length, 1);
  assert.equal(getCanvasTextEdges(disconnectCanvasText(linked, 'b', 'a')).length, 0);
});

for (const content of ['', '旧正文']) test(`原节点覆盖保留历史及位置连线：${content || '空节点'}`, () => {
  const nodes = [text('a', '上游'), text('b', content, ['a'])];
  nodes[1].parentId = 'group';
  const edges = getCanvasTextEdges(nodes);
  const plan = planCanvasTextGeneration(nodes, 'b', '续写', 'model');
  assert.equal(plan.resultId, 'b');
  const pending = beginCanvasTextGeneration(nodes, plan);
  assert.equal(pending.length, 2);
  assert.equal(pending[1].data.content, content);
  assert.equal(pending[1].data.generating, true);
  assert.equal(pending[1].data.submissionLocked, true);
  assert.deepEqual(pending[1].data.executionSourceIds, ['a']);
  assert.equal(pending[1].data.creationPanelOpen, false);
  const result = applyCanvasTextResult(pending, plan, '新正文');
  assert.equal(result.length, 2);
  assert.equal(result[1].data.content, '新正文');
  assert.equal(result[1].data.prompt, '草稿');
  assert.deepEqual(result[1].position, nodes[1].position);
  assert.equal(result[1].parentId, 'group');
  assert.deepEqual(getCanvasTextEdges(result), edges);
  assert.equal(result[1].data.generating, false);
  assert.equal(result[1].data.submissionLocked, false);
  assert.equal(result[1].data.executionSourceIds, undefined);
  assert.deepEqual(result[1].data.nodeResults.batches.at(-1).taskIds, []);
  assert.equal(result[1].data.nodeResults.batches.length, content ? 2 : 1);
  if (content) assert.equal(result[1].data.nodeResults.batches[0].results[0].content, content);
  assert.strictEqual(applyCanvasTextResult(result, plan, '重复'), result);
  const retry = planCanvasTextGeneration(result, 'b', '再写', 'model');
  const next = applyCanvasTextResult(beginCanvasTextGeneration(result, retry), retry, '又一版');
  assert.equal(next[1].data.content, '又一版');
  assert.equal(next[1].data.nodeResults.batches.length, (content ? 2 : 1) + 1);
});

test('只读直连上游排除自身，空提示词按序合并且不重复作为参考', () => {
  const nodes = [text('a', 'A'), text('b', 'B', ['a']), text('c', 'C', ['b', 'c'])];
  const plan = planCanvasTextGeneration(nodes, 'c', '续写', 'model');
  assert.deepEqual(plan.sources.map((source) => source.id), ['b']);
  assert.deepEqual(planCanvasTextGeneration(nodes, 'a', '续写', 'model').sources, []);
  nodes[2].data.textSourceIds = ['b', 'a'];
  const empty = planCanvasTextGeneration(nodes, 'c', ' ', 'model');
  assert.equal(empty.prompt, 'B\n\nA');
  assert.deepEqual(JSON.parse(empty.messages[1].content), { materials: [], instruction: 'B\n\nA' });
  nodes[1].data.content = '修改';
  assert.equal(plan.snapshot.inputs[0].content, 'B');
});

test('自身与上游运行中、缺失参考、无有效指令均禁止执行', () => {
  for (const flag of ['generating', 'submissionLocked', 'editing']) for (const index of [0, 1]) {
    const nodes = [text('a', '上游'), text('b', '', ['a'])];
    nodes[index].data[flag] = true;
    assert.throws(() => planCanvasTextGeneration(nodes, 'b', '创作', 'model'), /正在/);
  }
  assert.throws(() => planCanvasTextGeneration([text('b', '', ['missing'])], 'b', '创作', 'model'), /上游/);
  assert.throws(() => planCanvasTextGeneration([text('a'), text('b', '', ['a'])], 'b', '创作', 'model'), /上游/);
  assert.throws(() => planCanvasTextGeneration([text('b', '旧正文')], 'b', ' ', 'model'), /提示词/);
  assert.throws(() => planCanvasTextGeneration([text('b')], 'b', '创作', ''), /模型/);
});

test('失败保留旧结果，空输出拒绝，删除及新请求阻止迟到写回', () => {
  const nodes = [text('a', 'A'), text('b', 'B', ['a'])];
  const plan = planCanvasTextGeneration(nodes, 'b', '创作', 'model');
  const pending = beginCanvasTextGeneration(nodes, plan);
  assert.throws(() => applyCanvasTextResult(pending, plan, ' '), /为空/);
  const failed = recoverCanvasTextGenerationFailure(pending, plan);
  assert.equal(failed[1].data.content, 'B');
  assert.equal(failed[1].data.nodeResults, undefined);
  assert.equal(failed[1].data.submissionLocked, false);
  assert.equal(failed[1].data.executionSourceIds, undefined);
  const edited = pending.map((node) => node.id === 'b' ? { ...node, data: { ...node.data, content: '手写' } } : node);
  assert.equal(applyCanvasTextResult(edited, plan, '结果')[1].data.content, '手写');
  const deleted = [pending[0]];
  assert.strictEqual(applyCanvasTextResult(deleted, plan, '结果'), deleted);
  const next = planCanvasTextGeneration(failed, 'b', '重试', 'model');
  const current = beginCanvasTextGeneration(failed, next);
  assert.strictEqual(applyCanvasTextResult(current, plan, '过期'), current);
  assert.equal(recoverCanvasTextGenerationFailure(current, plan)[1].data.generationRequestId, next.requestId);
});

test('文本API仅返回终态正文，无服务端任务编号', async () => {
  const server = await createTestViteServer({ server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom' });
  const original = { fetch: globalThis.fetch, localStorage: globalThis.localStorage, window: globalThis.window, CustomEvent: globalThis.CustomEvent };
  try {
    globalThis.localStorage = { getItem: () => 'test-token' };
    globalThis.window = { dispatchEvent: () => {} };
    globalThis.CustomEvent = class { constructor(type) { this.type = type; } };
    const { apiGenerateCanvasText } = await server.ssrLoadModule('/src/api/llm.js');
    const plan = planCanvasTextGeneration([text('a', '素材'), text('b', '', ['a'])], 'b', '续写', 'test-model');
    globalThis.fetch = async (url, options) => {
      assert.ok(url.endsWith('/api/llm/chat'));
      const body = JSON.parse(options.body);
      assert.equal(body.model, 'test-model');
      assert.equal(JSON.parse(body.messages[1].content).materials[0].content, '素材');
      return new Response(JSON.stringify({ choices: [{ message: { content: '结果' } }] }));
    };
    assert.equal(await apiGenerateCanvasText(plan), '结果');
    globalThis.fetch = async () => new Response('{}');
    await assert.rejects(apiGenerateCanvasText(plan), /未返回有效文本/);
    globalThis.fetch = async () => new Response('{}', { status: 500 });
    await assert.rejects(apiGenerateCanvasText(plan));
  } finally { Object.assign(globalThis, original); await server.close(); }
});
