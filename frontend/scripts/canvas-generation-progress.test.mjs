import test from 'node:test';
import assert from 'node:assert/strict';
import { CANVAS_GENERATION_FALLBACK, getCanvasProgressMessage, createCanvasProgressHandler } from '../src/components/canvas/CanvasGenerationProgress.js';

test('空白和非文本进度使用兜底', () => {
  for (const value of [undefined, null, '', '  ', {}, 30]) assert.equal(getCanvasProgressMessage(value), CANVAS_GENERATION_FALLBACK);
  assert.equal(getCanvasProgressMessage('  正在处理  '), '正在处理');
});

test('进度仅更新匹配且仍在生成的任务，不记录撤销历史', () => {
  const nodes = [
    { data: { generating: true, generationRequestId: 'a' } },
    { data: { generating: true, generationRequestId: 'b' } },
    { data: { generating: false, generationRequestId: 'a' } },
  ];
  let updated;
  const handler = createCanvasProgressHandler((apply, options) => {
    assert.equal(options.record, false);
    updated = apply(nodes);
  }, 'a', new AbortController().signal);
  handler({ message: '正在处理' });
  assert.equal(updated[0].data.generationMessage, '正在处理');
  assert.equal(updated[0].data.generationMessageRequestId, 'a');
  assert.equal(updated[1], nodes[1]);
  assert.equal(updated[2], nodes[2]);
});

test('取消后不写入进度，包括延迟执行的状态更新', () => {
  const controller = new AbortController();
  let pending;
  const handler = createCanvasProgressHandler((apply) => { pending = apply; }, 'a', controller.signal);
  handler({ message: '处理' });
  controller.abort();
  const nodes = [{ data: { generating: true, generationRequestId: 'a' } }];
  assert.equal(pending(nodes), nodes);
  createCanvasProgressHandler(() => assert.fail('取消后不应提交状态'), 'a', controller.signal)({ message: '处理' });
});
