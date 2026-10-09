import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/components/canvas/TextCanvasNode.jsx', import.meta.url), 'utf8');

// 执行组件实际的事件处理器，验证组合输入阶段不会提交半成品拼音。
function createHandlers() {
  const changes = [];
  const composingRef = { current: false };
  let editing = true;
  const handlers = {};
  for (const name of ['handleContentChange', 'handleCompositionEnd', 'handleBlur']) {
    const body = source.match(new RegExp(`const ${name} = \\(event\\) => \\{([\\s\\S]*?)\\n  \\};`))?.[1];
    assert.ok(body, name);
    handlers[name] = new Function('composingRef', 'data', 'id', 'setEditing', 'event', body)
      .bind(null, composingRef, { onContentChange: (id, value) => changes.push([id, value]) }, 'text-1', (value) => { editing = value; });
  }
  return { ...handlers, changes, composingRef, isEditing: () => editing };
}

const event = (value, isComposing = false) => ({ currentTarget: { value }, nativeEvent: { isComposing } });

test('非编辑正文放行画布滚动，编辑状态保留输入框滚动隔离', () => {
  assert.match(source, /canvas-node__text-content \$\{editing \? 'nodrag nowheel nopan' : ''\}/);
  const textarea = source.match(/<textarea[\s\S]*?\/>/)?.[0];
  assert.ok(textarea);
  assert.match(textarea, /className="canvas-node__text-editor nodrag nowheel nopan"/);
});

test('编辑正文不再受画布回传值控制，保留组合输入事件', () => {
  const textarea = source.match(/<textarea[\s\S]*?\/>/)?.[0];
  assert.ok(textarea);
  assert.match(textarea, /defaultValue=\{data\?\.content \|\| ''\}/);
  assert.doesNotMatch(textarea, /\bvalue=/);
  assert.match(textarea, /onCompositionStart=\{\(\) => \{ composingRef\.current = true; \}\}/);
  assert.match(textarea, /onCompositionEnd=\{handleCompositionEnd\}/);
});

test('连续拼音只在选字结束时同步完整中文，下一轮输入仍受保护', () => {
  const state = createHandlers();
  state.composingRef.current = true;
  for (const value of ['n', 'ni', 'nih', 'nihao']) state.handleContentChange(event(value));
  assert.deepEqual(state.changes, []);
  state.handleCompositionEnd(event('你好'));
  assert.deepEqual(state.changes, [['text-1', '你好']]);
  state.composingRef.current = true;
  state.handleContentChange(event('你好shi'));
  state.handleCompositionEnd(event('你好世界'));
  assert.deepEqual(state.changes.at(-1), ['text-1', '你好世界']);
});

test('原生组合标记同样保护输入，英文、删除和换行正常同步', () => {
  const state = createHandlers();
  state.handleContentChange(event('zhong', true));
  assert.deepEqual(state.changes, []);
  for (const value of ['hello', 'hello\n世界', '']) state.handleContentChange(event(value));
  assert.deepEqual(state.changes.map(([, value]) => value), ['hello', 'hello\n世界', '']);
});

test('失焦提交输入框最终正文并清理组合状态', () => {
  const state = createHandlers();
  state.composingRef.current = true;
  state.handleBlur(event('最终正文'));
  assert.deepEqual(state.changes, [['text-1', '最终正文']]);
  assert.equal(state.composingRef.current, false);
  assert.equal(state.isEditing(), false);
});
