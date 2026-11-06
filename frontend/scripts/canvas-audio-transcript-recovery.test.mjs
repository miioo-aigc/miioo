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
