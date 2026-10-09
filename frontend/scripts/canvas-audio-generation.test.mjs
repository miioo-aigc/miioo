import test from 'node:test';
import assert from 'node:assert/strict';
import { createCanvasNode } from '../src/components/canvas/canvasNodeUtils.js';
import { connectTextToAudio, isTextAudioConnection } from '../src/components/canvas/CanvasTextAudio.js';
import { planCanvasAudioGeneration, beginCanvasAudioGeneration, finishCanvasAudioGeneration } from '../src/components/canvas/CanvasAudioGeneration.js';

test('音频只接受文本和音频，按连接顺序追加文本', () => {
  let nodes = ['text', 'text', 'audio', 'image', 'video'].map((type, i) => createCanvasNode(type, undefined, `${i}`));
  nodes[0].data.content = '甲'; nodes[1].data.content = '乙';
  for (const source of ['1', '0']) nodes = connectTextToAudio(nodes, { source, target: '2' });
  assert.equal(nodes[2].data.prompt, '乙\n甲');
  for (const source of ['3', '4']) assert.equal(isTextAudioConnection(nodes, { source, target: '2' }), false);
});

test('只收集直连上游，请求前创建结果和连线，失败不覆盖原节点', () => {
  let nodes = ['a', 'b', 'c', 'd'].map((id) => createCanvasNode('audio', { x: 0, y: 0 }, id));
  nodes = connectTextToAudio(nodes, { source: 'a', target: 'b' });
  nodes = connectTextToAudio(nodes, { source: 'b', target: 'c' });
  nodes = connectTextToAudio(nodes, { source: 'c', target: 'd' });
  nodes[2].data.asset = { url: '/c.mp3' };
  const plan = planCanvasAudioGeneration(nodes, 'c', '台词', 'model');
  assert.deepEqual(plan.sources.map((source) => source.id), ['b', 'c']);
  const pending = beginCanvasAudioGeneration(nodes, plan);
  const result = pending.find((node) => node.id === plan.resultId);
  assert.equal(result.data.generating, true);
  assert.equal(result.data.creationPanelOpen, false);
  assert.deepEqual(result.data.audioSourceIds, ['b', 'c']);
  const failed = finishCanvasAudioGeneration(pending, plan);
  assert.equal(failed.find((node) => node.id === plan.resultId).data.asset, null);
  assert.equal(failed.find((node) => node.id === 'c').data.asset.url, '/c.mp3');
  assert.equal(finishCanvasAudioGeneration(pending.filter((node) => node.id !== plan.resultId), plan, { url: '/result.mp3' }).length, 4);
});

test('空音频原地生成，过期结果不能写回', () => {
  const nodes = [createCanvasNode('audio', undefined, 'a')];
  const plan = planCanvasAudioGeneration(nodes, 'a', '台词', 'model');
  assert.equal(plan.createsResult, false);
  const pending = beginCanvasAudioGeneration(nodes, plan);
  assert.equal(finishCanvasAudioGeneration(pending, plan, { url: '/a.mp3' })[0].data.asset.url, '/a.mp3');
  assert.equal(finishCanvasAudioGeneration(nodes, plan, { url: '/a.mp3' })[0].data.asset, null);
});
