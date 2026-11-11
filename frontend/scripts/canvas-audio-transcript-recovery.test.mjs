import test from 'node:test';
import assert from 'node:assert/strict';
import { commitCanvasNodeOutput, selectCanvasNodeOutput } from '../src/components/canvas/CanvasResultMutations.js';
import { getCanvasAudioTranscript, commitCanvasMediaOutput } from '../src/components/canvas/CanvasAssets.js';
import { serializeCanvasDocument, readCanvasDocument } from '../src/components/canvas/CanvasDocument.js';
import { resolveCanvasDocumentAssets } from '../src/components/canvas/CanvasAssetResolver.js';

const first = '11111111-1111-4111-8111-111111111111';
const second = '22222222-2222-4222-8222-222222222222';
const uploaded = '33333333-3333-4333-8333-333333333333';
const transcript = (node) => getCanvasAudioTranscript(node.data.asset, node.data.nodeResults);
function generate(node, id, prompt) {
  return commitCanvasNodeOutput(node, { id, source: 'generation', requestedCount: 1,
    results: [{ id: `result-${id}`, index: 0, type: 'audio', assetId: id }],
    submittedAt: 1, completedAt: 2, snapshot: { prompt } },
  { [id]: { asset_id: id, asset_type: 'audio', url: '/audio.mp3', transcript: prompt } });
}
async function refresh(node) {
  const document = JSON.parse(JSON.stringify(serializeCanvasDocument([node])));
  const restored = readCanvasDocument({ document });
  return (await resolveCanvasDocumentAssets('canvas', restored.nodes, async (_, ids) => ({
    items: ids.map((asset_id) => ({ asset_id, media_type: 'audio', availability: 'ready', download_url: '/restored.mp3' })),
  })))[0];
}
// 解析响应按后端约定携带 transcript 时，刷新后由素材视图恢复；缺字段时行为不变。
async function refreshWithViews(node, view, mediaType = 'audio') {
  const document = JSON.parse(JSON.stringify(serializeCanvasDocument([node])));
  const restored = readCanvasDocument({ document });
  return (await resolveCanvasDocumentAssets('canvas', restored.nodes, async (_, ids) => ({
    items: ids.map((asset_id) => ({ asset_id, media_type: mediaType, availability: 'ready', download_url: '/restored.mp3', ...view })),
  })))[0];
}
test('生成台词经过真实保存、读取与素材恢复后仍绑定当前结果，忽略编辑后的提示词', async () => {
  let node = { id: 'audio', type: 'audio', position: { x: 0, y: 0 }, data: { asset: null } };
  node = generate(node, first, '第一段台词');
  node = generate(node, second, '第二段台词');
  node.data.prompt = '尚未生成的新草稿';
  node = await refresh(node);
  assert.equal(node.data.asset.transcript, undefined);
  assert.equal(transcript(node), '第二段台词');
  node = selectCanvasNodeOutput(node, `result-${first}`);
  assert.equal(transcript(node), '第一段台词');
  assert.equal(node.data.transcript, '第一段台词');
  node = await refresh(node);
  assert.equal(transcript(node), '第一段台词');
  node = commitCanvasMediaOutput(node, { asset_id: uploaded, asset_type: 'audio', url: '/upload.mp3', source: 'local-upload' }, 'upload');
  assert.equal(transcript(node), '');
  node = await refresh(node);
  assert.equal(transcript(node), '');
  node = selectCanvasNodeOutput(node, `result-${second}`);
  assert.equal(transcript(node), '第二段台词');
});
test('不借用其他结果或输入框台词，无历史时仍兼容素材自带台词', () => {
  const node = generate({ id: 'audio', type: 'audio', data: {} }, first, '对应台词');
  assert.equal(getCanvasAudioTranscript({ asset_id: second, transcript: '错误素材' }, node.data.nodeResults), '');
  assert.equal(getCanvasAudioTranscript({ transcript: ' 素材台词 ' }), '素材台词');
});
test('刷新时从解析响应的台词字段恢复，卡片与历史浮层读同一份素材视图', async () => {
  // 资产库选入的音频：本地不保存台词，只保存素材编号。
  let node = { id: 'audio', type: 'audio', position: { x: 0, y: 0 }, data: { asset: null } };
  node = commitCanvasMediaOutput(node, { asset_id: uploaded, asset_type: 'audio', url: '/upload.mp3', source: 'asset-library' }, 'upload');
  assert.equal(transcript(node), '');
  node = await refreshWithViews(node, { transcript: ' 后端补齐的台词 ' });
  assert.equal(node.data.asset.transcript, '后端补齐的台词');
  assert.equal(node.data.resultAssetViews[uploaded].transcript, '后端补齐的台词');
  assert.equal(transcript(node), '后端补齐的台词');
  // 历史结果浮层直接读同一份素材视图。
  assert.equal(node.data.resultAssetViews[uploaded].transcript, '后端补齐的台词');
});
test('解析响应缺少台词字段时行为不变，非音频或空台词不注入', async () => {
  const node = commitCanvasMediaOutput({ id: 'audio', type: 'audio', position: { x: 0, y: 0 }, data: {} },
    { asset_id: uploaded, asset_type: 'audio', url: '/upload.mp3', source: 'asset-library' }, 'upload');
  const missing = await refreshWithViews(node, {});
  assert.equal(missing.data.asset.transcript, undefined);
  assert.equal(transcript(missing), '');
  const blank = await refreshWithViews(node, { transcript: '   ' });
  assert.equal(blank.data.asset.transcript, undefined);
  const image = commitCanvasMediaOutput({ id: 'image', type: 'image', position: { x: 0, y: 0 }, data: {} },
    { asset_id: second, asset_type: 'image', url: '/image.png', source: 'asset-library' }, 'upload');
  const nonAudio = await refreshWithViews(image, { transcript: '不该出现' }, 'image');
  assert.equal(nonAudio.data.asset.transcript, undefined);
});
