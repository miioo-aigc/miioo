import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  isDegenerateRect,
  resolveInlineMenuAnchorRect,
  resolveInlineMenuOffset,
} from '../src/components/creation/DubbingInlineMenuPosition.js';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const DEGENERATE = { top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0 };

test('空输入：退化的光标矩形回退到文本区左上角光标行', () => {
  const fallback = { top: 600, bottom: 624, left: 800, right: 800, width: 0, height: 24 };
  assert.ok(isDegenerateRect(DEGENERATE));
  assert.equal(resolveInlineMenuAnchorRect(DEGENERATE, fallback), fallback);
});

test('有内容：正常光标矩形保持不变', () => {
  const caret = { top: 610, bottom: 632, left: 820, right: 820, width: 0, height: 22 };
  const fallback = { top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0 };
  assert.equal(isDegenerateRect(caret), false);
  assert.equal(resolveInlineMenuAnchorRect(caret, fallback), caret);
});

test('空输入时菜单落在光标所在行正下方且不飞出输入框', () => {
  const editorRect = { top: 600, bottom: 660, left: 800, right: 1100, width: 300, height: 60 };
  const fallback = { top: 600, bottom: 624, left: 800, right: 800, width: 0, height: 24 };
  const anchor = resolveInlineMenuAnchorRect(DEGENERATE, fallback);
  const offset = resolveInlineMenuOffset(anchor, editorRect, 100, 180, 1440, 900);
  assert.deepEqual(offset, { top: 32, left: 0 });
  assert.ok(offset.top > 0 && offset.left >= 0);
});

test('空间不足时翻到光标上方，左右夹在视口内', () => {
  const editorRect = { top: 800, bottom: 880, left: 1200, right: 1420, width: 220, height: 80 };
  const anchor = { top: 840, bottom: 862, left: 1400, right: 1400, width: 0, height: 22 };
  const offset = resolveInlineMenuOffset(anchor, editorRect, 100, 180, 1440, 900);
  assert.equal(offset.top, 652 - 800);
  assert.equal(offset.left, 1332 - 1200);
});

test('hook 使用纯函数定位并保留文本区左上角回退', () => {
  const hook = read('../src/components/creation/useCreationPromptInteraction.js');
  assert.match(hook, /import \{ resolveInlineMenuAnchorRect, resolveInlineMenuOffset \} from '\.\/DubbingInlineMenuPosition';/);
  assert.match(hook, /resolveInlineMenuAnchorRect\(getRangeRect\(range\), \{/);
  assert.match(hook, /style\.paddingTop/);
  assert.match(hook, /style\.paddingLeft/);
});
