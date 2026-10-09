import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { createCanvasNode } from '../src/components/canvas/canvasNodeUtils.js';
import { connectCanvasText, disconnectCanvasText, isCanvasTextConnection, getCanvasTextEdges, planCanvasTextGeneration, beginCanvasTextGeneration, applyCanvasTextResult, recoverCanvasTextGenerationFailure } from '../src/components/canvas/CanvasTextGeneration.js';

const text = (id, content = '', sources = []) => ({ ...createCanvasNode('text', { x: 100, y: 200 }, id), data: { content, textSourceIds: sources } });
for (const content of ['', '已有正文']) {
  test(`发送创作收起输入框且结果不自动展开：${content || '空节点'}`, () => {
    const source = createCanvasNode('text', { x: 100, y: 200 }, 'a');
    source.data = { ...source.data, content, prompt: '续写' };
    const nodes = [source];
    assert.equal(source.data.creationPanelOpen, true);
    assert.throws(() => planCanvasTextGeneration(nodes, 'a', ' ', 'model'));
    assert.equal(source.data.creationPanelOpen, true);
    const plan = planCanvasTextGeneration(nodes, 'a', '续写', 'model', 'result');
    const pending = beginCanvasTextGeneration(nodes, plan);
    assert.equal(pending.find((node) => node.id === 'a').data.creationPanelOpen, false);
    const result = pending.find((node) => node.id === plan.resultId);
    assert.equal(result.selected, true);
    assert.equal(result.data.creationPanelOpen, false);
    assert.equal(result.data.generating, true);
    assert.equal(pending[0].data.prompt, '续写');
    for (const finished of [applyCanvasTextResult(pending, plan, '生成结果'), recoverCanvasTextGenerationFailure(pending, plan)]) {
      assert.ok(finished.every((node) => node.data.creationPanelOpen === false));
      assert.equal(finished[0].data.prompt, '续写');
    }
    assert.equal(createCanvasNode('text').data.creationPanelOpen, true);
  });
}
test('文本仅接受文本，拒绝自身与错误端口；重复连接不重复添加', () => {
  const nodes = [text('a'), text('b'), createCanvasNode('image', undefined, 'image')];
  assert.equal(isCanvasTextConnection(nodes, { source: 'image', target: 'b' }), false);
  assert.equal(isCanvasTextConnection(nodes, { source: 'b', target: 'b' }), false);
  assert.equal(isCanvasTextConnection(nodes, { source: 'a', target: 'b', targetHandle: 'audio-input' }), false);
  const linked = connectCanvasText(nodes, { source: 'a', target: 'b' });
  assert.equal(getCanvasTextEdges(connectCanvasText(linked, { source: 'a', target: 'b' })).length, 1);
  assert.equal(getCanvasTextEdges(disconnectCanvasText(linked, 'b', 'a')).length, 0);
  assert.equal(getCanvasTextEdges(linked.filter((node) => node.id !== 'a')).length, 0);
  for (const type of ['image', 'video', 'audio']) assert.equal(isCanvasTextConnection([createCanvasNode(type, undefined, 'media'), text('b')], { source: 'media', target: 'b' }), false);
});

test('通用文本请求透传模型与素材，处理有效、空及失败响应', async () => {
  const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom' });
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
  } finally {
    Object.assign(globalThis, original);
    await server.close();
  }
});
test('链式只取直接上游，多路输入收集全部直接上游', () => {
  const nodes = [text('a', 'A'), text('b', 'B', ['a']), text('c', 'C', ['b']), text('d', '', ['c'])];
  assert.deepEqual(planCanvasTextGeneration(nodes, 'd', '续写', 'model').sources.map((n) => n.id), ['c']);
  nodes[3].data.textSourceIds = ['a', 'b', 'c'];
  assert.deepEqual(planCanvasTextGeneration(nodes, 'd', '续写', 'model').sources.map((n) => n.id), ['a', 'b', 'c']);
  assert.deepEqual(planCanvasTextGeneration(nodes, 'a', '续写', 'model').sources.map((n) => n.id), ['a']);
});
test('空目标承接素材及结果，已有正文则新建结果并连接素材', () => {
  const nodes = [text('a', '素材A'), text('b', '', ['a'])];
  const plan = planCanvasTextGeneration(nodes, 'b', '续写', 'model');
  const first = applyCanvasTextResult(beginCanvasTextGeneration(nodes, plan), plan, '结果B');
  assert.equal(first.length, 2);
  assert.match(first[1].data.content, /素材A[\s\S]*结果B/);
  const nextPlan = planCanvasTextGeneration(first, 'b', '再写', 'model', 'c');
  const pending = beginCanvasTextGeneration(first, nextPlan);
  assert.equal(pending.length, 3);
  assert.equal(pending[2].data.content, '');
  assert.equal(pending[2].data.generating, true);
  assert.equal(pending[1].data.generating, false);
  assert.equal(pending[1].data.generationPending, false);
  assert.deepEqual(getCanvasTextEdges(pending).map((edge) => `${edge.source}->${edge.target}`), ['a->b', 'a->c', 'b->c']);
  const next = applyCanvasTextResult(pending, nextPlan, '结果C');
  assert.equal(next.length, 3);
  assert.equal(next[1].data.content, first[1].data.content);
  assert.deepEqual(next[2].data.textSourceIds, ['a', 'b']);
  assert.equal(next[2].data.content, '结果C');
});
test('请求期间编辑不覆盖，删除目标不复活；空提示词与模型拦截', () => {
  const nodes = [text('a', '素材'), text('b', '', ['a'])];
  const plan = planCanvasTextGeneration(nodes, 'b', '续写', 'model');
  const edited = nodes.map((n) => n.id === 'b' ? { ...n, data: { ...n.data, content: '手写' } } : n);
  assert.equal(applyCanvasTextResult(edited, plan, '结果', 'c')[1].data.content, '手写');
  assert.equal(applyCanvasTextResult([nodes[0]], plan, '结果', 'c').length, 1);
  assert.throws(() => planCanvasTextGeneration(nodes, 'b', ' ', 'model'));
  assert.throws(() => planCanvasTextGeneration(nodes, 'b', '续写', ''));
});

test('请求失败时不把上游素材回填到空目标', () => {
  const nodes = [text('a', '素材A'), text('b', '', ['a'])];
  const plan = planCanvasTextGeneration(nodes, 'b', '续写', 'model');
  const pending = beginCanvasTextGeneration(nodes, plan);
  assert.equal(pending[1].data.content, '');
  assert.equal(pending[1].data.generating, true);
  const failed = recoverCanvasTextGenerationFailure(pending, plan);
  assert.equal(failed.find((node) => node.id === 'b').data.content, '');
  assert.equal(failed.find((node) => node.id === 'b').data.generationError, '');
  assert.equal(failed[1].data.generating, false);
});

test('派生结果失败保留空节点及连线；成功或失败均不覆盖手动编辑、不复活删除节点', () => {
  const nodes = [text('a', 'A'), text('b', 'B', ['a'])];
  const plan = planCanvasTextGeneration(nodes, 'b', '续写', 'model', 'c');
  const pending = beginCanvasTextGeneration(nodes, plan);
  const failed = recoverCanvasTextGenerationFailure(pending, plan);
  assert.equal(failed.length, 3);
  assert.equal(failed[2].data.content, '');
  assert.equal(failed[2].data.generating, false);
  assert.equal(failed[1].data.generationPending, false);
  assert.equal(failed[2].data.generationError, '');
  assert.deepEqual(failed[2].data.textSourceIds, ['a', 'b']);
  const edited = pending.map((node) => node.id === 'c' ? { ...node, data: { ...node.data, content: '手写' } } : node);
  assert.equal(applyCanvasTextResult(edited, plan, '结果')[2].data.content, '手写');
  assert.equal(recoverCanvasTextGenerationFailure(edited, plan)[2].data.content, '手写');
  assert.equal(applyCanvasTextResult(nodes, plan, '结果').length, 2);
  assert.equal(recoverCanvasTextGenerationFailure(nodes, plan).length, 2);
});
