import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCanvasShareLink, parseCanvasShareRoute, enableAndCopyCanvasShare } from '../src/components/canvas/CanvasShareLink.js';
import { readCanvasShareDocument, safeCanvasMediaUrl, prepareCanvasShareMedia } from '../src/components/canvas/CanvasShareDocument.js';
import { getSharedCanvasPresentation } from '../src/components/canvas/SharedCanvasGroups.js';

const record = (id, props = {}) => ({ id, type: 'free-canvas-node', x: 0, y: 10, props: { nodeType: 'text', ...props } });
const payload = (records, businessBindings = []) => ({ document: { schemaVersion: 1, engine: 'xyflow', records, businessBindings }, assets: [] });

test('缺少宽高时读取真实素材比例，首次布局同步节点宽度，失败保留默认尺寸', async (t) => {
  const sources = [];
  class Media {
    set src(value) {
      sources.push(value);
      this.naturalWidth = value.endsWith('failed') ? 0 : 900; this.naturalHeight = value.endsWith('failed') ? 0 : 1600;
      this.videoWidth = 1920; this.videoHeight = 1080;
      queueMicrotask(() => value.endsWith('failed') ? this.onerror() : (this.onload || this.onloadedmetadata)?.());
    }
    removeAttribute() {}
    load() {}
  }
  const originalImage = globalThis.Image;
  const originalDocument = globalThis.document;
  globalThis.Image = Media;
  globalThis.document = { createElement: () => new Media() };
  t.after(() => {
    if (originalImage === undefined) delete globalThis.Image; else globalThis.Image = originalImage;
    if (originalDocument === undefined) delete globalThis.document; else globalThis.document = originalDocument;
  });
  const ids = ['image', 'video', 'failed', 'unsafe', 'known', 'unavailable'];
  const assetId = (index) => `00000000-0000-0000-0000-${String(index + 1).padStart(12, '0')}`;
  const data = payload(ids.map((id, index) => record(id, { assetId: assetId(index), nodeType: id === 'video' ? 'video' : 'image' })));
  data.assets = ids.map((id, index) => ({ asset_id: assetId(index), media_type: id === 'video' ? 'video' : 'image',
    availability: id === 'unavailable' ? 'missing' : 'ready',
    original_url: id === 'unsafe' ? 'javascript:bad()' : `https://a/${id}`,
    preview_url: id === 'video' ? 'https://a/video' : undefined,
    thumbnail_url: id === 'image' ? 'https://a/square-thumb' : undefined,
    ...(id === 'known' ? { width: 1600, height: 900 } : {}),
  }));
  const graph = await prepareCanvasShareMedia(readCanvasShareDocument(data));
  assert.deepEqual(sources, ['https://a/square-thumb', 'https://a/video', 'https://a/failed']);
  assert.deepEqual(graph.nodes[0].data.mediaSize, { width: 182, height: 322 });
  assert.deepEqual(graph.nodes[1].data.mediaSize, { width: 322, height: 182 });
  assert.deepEqual(graph.nodes[4].data.mediaSize, { width: 322, height: 182 });
  for (const index of [2, 3, 5]) assert.deepEqual(graph.nodes[index].data.mediaSize, { width: 240, height: 240 });
  for (const node of graph.nodes) assert.equal(node.style.width, node.data.mediaSize.width);
  assert.equal(data.assets[0].width, undefined);
});

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
  assert.equal(graph.edges[0].type, 'default');
  assert.deepEqual(graph.nodes[0].data.mediaSize, { width: 240, height: 240 });
  assert.equal(graph.nodes[0].style.width, 240);
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

test('公开页保留组框、父子层级及成员相对坐标', () => {
  const graph = readCanvasShareDocument(payload([
    { id: 'group', type: 'canvasGroup', x: 100, y: 200, props: { groupWidth: 600, groupHeight: 400 } },
    record('child', { parentId: 'group', content: '组合内文本' }),
  ]));
  assert.equal(graph.nodes.length, 2);
  assert.equal(graph.nodes[0].type, 'canvasGroup');
  assert.equal(graph.nodes[0].data.readOnly, true);
  assert.deepEqual(graph.nodes[0].style, { width: 600, height: 400 });
  assert.equal(graph.nodes[1].parentId, 'group');
  assert.deepEqual(graph.nodes[1].position, { x: 0, y: 10 });
});

test('嵌套折叠组临时展开恢复成员和连线，不修改作者保存状态', () => {
  const data = payload([
    record('child', { parentId: 'inner', content: '正文' }),
    { id: 'inner', type: 'canvasGroup', x: 20, y: 30, props: { parentId: 'outer', label: '内组', stacked: true, groupWidth: 500, groupHeight: 400 } },
    { id: 'outer', type: 'canvasGroup', x: 100, y: 200, props: { label: '外组', stacked: true, stackOffset: { x: 40, y: 60 }, groupWidth: 800, groupHeight: 600 } },
    record('outside', { textSourceIds: ['child'] }),
  ]);
  const graph = readCanvasShareDocument(data);
  const original = structuredClone(graph);
  assert.deepEqual(graph.nodes.map((node) => node.id), ['outer', 'inner', 'child', 'outside']);
  const folded = getSharedCanvasPresentation(graph);
  assert.deepEqual(folded.nodes[0].position, { x: 140, y: 260 });
  assert.equal(folded.nodes[0].style.width, 312);
  assert.equal(folded.nodes[1].hidden, true);
  assert.equal(folded.nodes[2].hidden, true);
  assert.equal(folded.edges[0].source, 'outer');
  const partial = getSharedCanvasPresentation(graph, ['outer']);
  assert.equal(partial.nodes[1].hidden, false);
  assert.equal(partial.nodes[2].hidden, true);
  assert.equal(partial.edges[0].source, 'inner');
  const expanded = getSharedCanvasPresentation(graph, ['outer', 'inner']);
  assert.equal(expanded.nodes[2].hidden, false);
  assert.equal(expanded.edges[0].source, 'child');
  assert.deepEqual(expanded.nodes[0].position, { x: 100, y: 200 });
  assert.equal(expanded.nodes[0].style.width, 800);
  assert.deepEqual(graph, original);
  assert.deepEqual(getSharedCanvasPresentation(graph), folded);
  assert.deepEqual(getSharedCanvasPresentation(graph, ['outer']), partial);
});

test('原本展开的组也可临时折叠，再展开恢复原尺寸和位置', () => {
  const graph = readCanvasShareDocument(payload([
    { id: 'group', type: 'canvasGroup', x: 125, y: 230, props: { groupWidth: 700, groupHeight: 500, stackOffset: { x: 60, y: 80 } } },
    record('child', { parentId: 'group' }),
  ]));
  const original = structuredClone(graph);
  const expanded = getSharedCanvasPresentation(graph);
  const folded = getSharedCanvasPresentation(graph, ['group']);
  assert.equal(folded.nodes[0].data.stacked, true);
  assert.equal(folded.nodes[0].style.width, 312);
  assert.deepEqual(folded.nodes[0].position, { x: 185, y: 310 });
  assert.equal(folded.nodes[1].hidden, true);
  assert.equal(expanded.nodes[1].style.pointerEvents, 'all');
  assert.deepEqual(getSharedCanvasPresentation(graph), expanded);
  assert.deepEqual(graph, original);
});

test('折叠预览识别公开图片素材，不使用不安全或不可用地址', () => {
  const assetId = '00000000-0000-0000-0000-000000000001';
  const data = payload([
    { id: 'group', type: 'canvasGroup', x: 0, y: 0, props: { stacked: true, groupWidth: 600, groupHeight: 400 } },
    record('image', { parentId: 'group', nodeType: 'image', assetId }),
  ]);
  data.assets = [{ asset_id: assetId, media_type: 'image', availability: 'ready', original_url: 'https://a/original' }];
  const member = () => getSharedCanvasPresentation(readCanvasShareDocument(data)).nodes[0].data.stackMembers[0];
  assert.equal(member().type, 'image');
  assert.equal(member().asset.url, 'https://a/original');
  data.assets[0].original_url = 'javascript:bad()';
  assert.equal(member().asset, null);
  data.assets[0].original_url = 'https://a/original';
  data.assets[0].availability = 'missing';
  assert.equal(member().asset, null);
});
