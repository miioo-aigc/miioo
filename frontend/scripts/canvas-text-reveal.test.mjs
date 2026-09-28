import test from 'node:test';
import assert from 'node:assert/strict';
import { getRevealCharacters, getRevealLines, shouldRevealResult } from '../src/components/canvas/CanvasTextReveal.js';

test('只在生成结束且正文改变时触发，上传、编辑和失败不触发', () => {
  assert.equal(shouldRevealResult({ generating: true, content: '' }, { generating: false, content: '结果' }), true);
  for (const next of [{ content: '' }, { content: '结果', editing: true }, { content: '结果', generating: true }]) {
    assert.equal(shouldRevealResult({ generating: true, content: '' }, next), false);
  }
  assert.equal(shouldRevealResult({ content: '' }, { content: '上传' }), false);
  assert.equal(shouldRevealResult({ generating: true, content: '原文' }, { content: '原文' }), false);
});

test('按完整字符拆分，保留换行空格，长文本延迟不超过600ms', () => {
  const content = '中文 👨‍👩‍👧‍👦e\u0301\n下一行';
  const parts = getRevealCharacters(content);
  assert.equal(parts.map((part) => part.text).join(''), content);
  assert.ok(parts.some((part) => part.text === '👨‍👩‍👧‍👦'));
});

test('按实际排版行分组，自动换行和空行保留，逐行延迟封顶600ms', () => {
  const lines = getRevealLines([
    { text: '第一', top: 0 }, { text: '行', top: 0 },
    { text: '自动换行', top: 21 }, { text: '\n', top: 21 },
    { text: '\n', top: 42 }, { text: '尾行', top: 63 },
  ]);
  assert.deepEqual(lines.map((line) => line.text), ['第一行', '自动换行\n', '\n', '尾行']);
  assert.deepEqual(lines.map((line) => line.delay), [0, 90, 180, 270]);
  assert.equal(getRevealLines(Array.from({ length: 100 }, (_, i) => ({ text: '行', top: i * 21 }))).at(-1).delay, 600);
});
