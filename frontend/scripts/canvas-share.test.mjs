import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCanvasShareLink, parseCanvasShareRoute, enableAndCopyCanvasShare } from '../src/components/canvas/CanvasShareLink.js';
import { readCanvasShareDocument, safeCanvasMediaUrl } from '../src/components/canvas/CanvasShareDocument.js';

const record = (id, props = {}) => ({ id, type: 'free-canvas-node', x: 0, y: 10, props: { nodeType: 'text', ...props } });
const payload = (records, businessBindings = []) => ({ document: { schemaVersion: 1, engine: 'xyflow', records, businessBindings }, assets: [] });

test('链接固定使用前端域名且凭证编码可逆', () => {
  const url = new URL(buildCanvasShareLink('https://front.example', 'a/b ?'));
  assert.equal(url.origin, 'https://front.example');
  assert.deepEqual(parseCanvasShareRoute(url.pathname), { token: 'a/b ?' });
  assert.equal(parseCanvasShareRoute('/editor'), null);
  assert.deepEqual(parseCanvasShareRoute('/share/canvas/%xx'), { token: '' });
  assert.throws(() => buildCanvasShareLink('https://front.example', ''));
});

test('复制只开启分享，不依赖草稿和保存状态，不采用后端站点链接', async () => {
  const calls = [];
  assert.equal(await enableAndCopyCanvasShare({ canvasId: 'canvas-1', origin: 'https://front.example',
    enable: async (id) => { calls.push(id); return { share_enabled: true, share_token: 'token', share_path: 'https://backend.example/share' }; },
    copy: async (url) => calls.push(url),
  }), true);
  assert.deepEqual(calls, ['canvas-1', 'https://front.example/share/canvas/token']);
});

test('接口失败、无效凭证和剪贴板拒绝不报成功，切换画布不再复制', async () => {
  const options = { canvasId: '1', origin: 'https://front.example', enable: async () => ({ share_enabled: true, share_token: 't' }), copy: async () => {} };
  await assert.rejects(enableAndCopyCanvasShare({ ...options, enable: async () => { throw new Error('403'); } }), /403/);
  await assert.rejects(enableAndCopyCanvasShare({ ...options, enable: async () => ({ share_enabled: true }) }), /凭证/);
  await assert.rejects(enableAndCopyCanvasShare({ ...options, copy: async () => { throw new Error('拒绝'); } }), /拒绝/);
  assert.equal(await enableAndCopyCanvasShare({ ...options, active: () => false, copy: async () => assert.fail('不应复制') }), false);
});

test('公开文档按资产编号映射，保留各路地址语义与节点坐标', () => {
  const assetId = '00000000-0000-0000-0000-000000000001';
  const data = payload([record('1', { assetId, nodeType: 'image' })]);
  data.assets = [{ asset_id: assetId, media_type: 'image', availability: 'ready', width: 640, height: 480,
    thumbnail_url: 'https://a/thumb', preview_url: 'https://a/preview', poster_url: 'https://a/poster', original_url: 'https://a/original', download_url: 'https://a/download' }];
  const graph = readCanvasShareDocument(data);
  assert.deepEqual(graph.nodes[0].position, { x: 0, y: 10 });
  assert.deepEqual(graph.nodes[0].data.asset, data.assets[0]);
  assert.equal(graph.nodes[0].data.mediaType, 'image');
});

test('节点连线优先、绑定兜底、去重并丢弃悬空连线', () => {
  const graph = readCanvasShareDocument(payload([
    record('1'), record('2', { textSourceIds: ['1', '1', 'missing'] }), record('3'), record('4', { referenceInputs: [] }),
  ], [{ fromId: '1', toId: '3', enabled: true }, { fromId: '2', toId: '4', enabled: true }]));
  assert.deepEqual(graph.edges.map(({ source, target }) => [source, target]), [['1', '2'], ['1', '3']]);
});

test('空文档正常，旧格式、重复编号、未知版本不伪装为空态', () => {
  assert.equal(readCanvasShareDocument(payload([])).nodes.length, 0);
  assert.throws(() => readCanvasShareDocument({ document: { nodes: [] } }), /格式/);
  assert.throws(() => readCanvasShareDocument(payload([record('1'), record('1')])), /节点/);
  const future = payload([]); future.document.schemaVersion = 2;
  assert.throws(() => readCanvasShareDocument(future), /格式/);
  assert.equal(safeCanvasMediaUrl('javascript:alert(1)'), undefined);
  assert.equal(safeCanvasMediaUrl('data:text/html,test'), undefined);
  assert.equal(safeCanvasMediaUrl('https://assets.example/image'), 'https://assets.example/image');
});

test('公开页组合成员转换为绝对坐标且不引入编辑态组框', () => {
  const graph = readCanvasShareDocument(payload([
    { id: 'group', type: 'canvasGroup', x: 100, y: 200, props: { groupWidth: 600, groupHeight: 400 } },
    record('child', { parentId: 'group', content: '组合内文本' }),
  ]));
  assert.equal(graph.nodes.length, 1);
  assert.deepEqual(graph.nodes[0].position, { x: 100, y: 210 });
});
