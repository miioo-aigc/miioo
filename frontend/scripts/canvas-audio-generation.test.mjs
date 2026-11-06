import test from 'node:test';
import assert from 'node:assert/strict';
import { createCanvasNode } from '../src/components/canvas/canvasNodeUtils.js';
import { connectTextToAudio, isTextAudioConnection } from '../src/components/canvas/CanvasTextAudio.js';
import { planCanvasAudioGeneration, beginCanvasAudioGeneration, acceptCanvasAudioSubmission, finishCanvasAudioGeneration } from '../src/components/canvas/CanvasAudioGeneration.js';

test('音频只接受文本和音频，按连接顺序追加文本', () => {
  let nodes = ['text', 'text', 'audio', 'image', 'video'].map((type, i) => createCanvasNode(type, undefined, `${i}`));
  nodes[0].data.content = '甲'; nodes[1].data.content = '乙';
  for (const source of ['1', '0']) nodes = connectTextToAudio(nodes, { source, target: '2' });
  assert.equal(nodes[2].data.prompt, '乙\n甲');
  for (const source of ['3', '4']) assert.equal(isTextAudioConnection(nodes, { source, target: '2' }), false);
});

test('只收集直连上游，在原节点生成，失败不覆盖原节点', () => {
  let nodes = ['a', 'b', 'c', 'd'].map((id) => createCanvasNode('audio', { x: 0, y: 0 }, id));
  nodes = connectTextToAudio(nodes, { source: 'a', target: 'b' });
  nodes = connectTextToAudio(nodes, { source: 'b', target: 'c' });
  nodes = connectTextToAudio(nodes, { source: 'c', target: 'd' });
  nodes[2].data.asset = { url: '/c.mp3' };
  const plan = planCanvasAudioGeneration(nodes, 'c', '台词', 'model');
  assert.deepEqual(plan.sources.map((source) => source.id), ['b']);
  const pending = beginCanvasAudioGeneration(nodes, plan);
  const result = pending.find((node) => node.id === plan.resultId);
  assert.equal(result.data.generating, true);
  assert.equal(result.data.creationPanelOpen, false);
  assert.deepEqual(result.data.executionSourceIds, ['b']);
  const failed = finishCanvasAudioGeneration(pending, plan);
  assert.equal(failed.find((node) => node.id === plan.resultId).data.asset.url, '/c.mp3');
  assert.equal(failed.find((node) => node.id === 'c').data.asset.url, '/c.mp3');
  assert.equal(finishCanvasAudioGeneration(pending.filter((node) => node.id !== plan.resultId), plan, { url: '/result.mp3' }).length, 3);
});

test('空音频原地生成，缺少永久资产编号时不能写入历史，过期结果不能写回', () => {
  const nodes = [createCanvasNode('audio', undefined, 'a')];
  const plan = planCanvasAudioGeneration(nodes, 'a', '台词', 'model');
  assert.equal(plan.createsResult, true);
  const pending = beginCanvasAudioGeneration(nodes, plan);
  assert.throws(() => finishCanvasAudioGeneration(pending, plan, { url: '/a.mp3' }), /永久资产编号/);
  assert.equal(finishCanvasAudioGeneration(nodes, plan, { url: '/a.mp3' })[0].data.asset, null);
});

test('真实taskId解锁提交，终态追加历史并清除运行锁', () => {
  const audio = createCanvasNode('audio', undefined, 'audio');
  audio.data.asset = { asset_id: '12345678-1234-1234-1234-123456789abc', asset_type: 'audio', url: '/old.mp3' };
  const text = createCanvasNode('text', undefined, 'text');
  text.data.content = '输入';
  let nodes = connectTextToAudio([text, audio], { source: 'text', target: 'audio' });
  const plan = planCanvasAudioGeneration(nodes, 'audio', '新台词', 'model');
  assert.deepEqual(plan.sources.map((source) => source.id), ['text']);
  nodes = beginCanvasAudioGeneration(nodes, plan);
  assert.equal(nodes[1].data.submissionLocked, true);
  nodes = acceptCanvasAudioSubmission(nodes, plan, { taskId: 'real-task' });
  assert.equal(nodes[1].data.submissionLocked, false);
  assert.deepEqual(nodes[1].data.generationTaskIds, ['real-task']);
  nodes = finishCanvasAudioGeneration(nodes, plan, { asset_id: '22345678-1234-1234-1234-123456789abc',
    asset_type: 'audio', url: '/new.mp3', transcript: '新台词' });
  assert.equal(nodes[1].data.asset.url, '/new.mp3');
  assert.equal(nodes[1].data.nodeResults.batches.length, 2);
  assert.equal(nodes[1].data.generationTaskIds, undefined);
});

test('生成或替换上传中的当前节点与直连上游均被拒绝', () => {
  const audio = createCanvasNode('audio', undefined, 'audio');
  const text = createCanvasNode('text', undefined, 'text');
  text.data.content = '输入';
  const nodes = connectTextToAudio([text, audio], { source: 'text', target: 'audio' });
  const busySource = nodes.map((node) => node.id === 'text' ? { ...node, data: { ...node.data, generating: true } } : node);
  assert.throws(() => planCanvasAudioGeneration(busySource, 'audio', '新台词', 'model'), /执行|上传/);
  const uploadingTarget = nodes.map((node) => node.id === 'audio' ? { ...node, data: { ...node.data,
    pendingCanvasUpload: { asset: { uploadStatus: 'uploading' } } } } : node);
  assert.throws(() => planCanvasAudioGeneration(uploadingTarget, 'audio', '新台词', 'model'), /执行|上传/);
});
