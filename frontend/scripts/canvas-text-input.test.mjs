import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const source = readFileSync(new URL('../src/components/canvas/CanvasInlineTextEditor.jsx', import.meta.url), 'utf8');
function mount() {
  const changes = [], refs = [], effects = [], listeners = new Map(), timers = [];
  let options, markdown = '# 标题', finishes = 0;
  const editor = { isDestroyed: false, view: { composing: false }, storage: { markdown: { getMarkdown: () => markdown } } };
  const context = vm.createContext({
    useRef: (value) => { const ref = { current: value }; refs.push(ref); return ref; },
    useCallback: (fn) => fn, useEffect: (fn) => effects.push(fn),
    useEditor: (value) => { options = value; return editor; }, createCanvasTextEditorExtensions: () => [],
    window: { setTimeout: (fn) => timers.push(fn) },
    document: { addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: (name) => listeners.delete(name) },
  });
  const body = source.slice(source.indexOf('export default function'), source.indexOf('  return <div'));
  vm.runInContext(body.replace('export default ', '') + 'return { commit, finish }; }', context);
  const handlers = context.CanvasInlineTextEditor({ initialContent: markdown, onContentChange: (value) => changes.push(value), onFinish: () => finishes++ });
  editor.commands = { blur: () => options.onBlur({ editor }) };
  const cleanups = effects.map((effect) => effect());
  return { ...handlers, changes, refs, editor, listeners, options, cleanups, flush: () => timers.splice(0).forEach((fn) => fn()),
    update: (value) => { markdown = value; options.onUpdate({ editor }); }, finishes: () => finishes };
}
test('无修改退出不改写Markdown，失焦不重复结束', () => {
  const state = mount();
  state.finish(state.editor);
  state.options.onBlur({ editor: state.editor });
  assert.deepEqual(state.changes, []);
  assert.equal(state.finishes(), 1);
});
test('标题、粗体、列表和删除同步，同值不重复提交', () => {
  const state = mount();
  for (const value of ['# 新标题', '**粗体**', '- 列表', '']) state.update(value);
  state.update('');
  assert.deepEqual(state.changes, ['# 新标题', '**粗体**', '- 列表', '']);
});
test('组合输入不提交拼音，结束提交中文，下一轮仍受保护', () => {
  const state = mount();
  state.refs[4].current = true;
  state.update('ni'); state.update('nihao');
  assert.deepEqual(state.changes, []);
  state.refs[4].current = false;
  state.update('你好');
  state.editor.view.composing = true;
  state.update('你好shi');
  assert.deepEqual(state.changes, ['你好']);
  state.editor.view.composing = false;
  state.update('你好世界');
  assert.deepEqual(state.changes, ['你好', '你好世界']);
});
test('外部点击提交最终正文，清理监听', () => {
  const state = mount();
  state.refs[0].current = { contains: (target) => target === 'inside' };
  state.listeners.get('pointerdown')({ target: 'inside' });
  assert.equal(state.finishes(), 0);
  state.editor.view.composing = true;
  state.update('最终正文');
  state.listeners.get('pointerdown')({ target: 'outside' });
  state.flush();
  assert.deepEqual(state.changes, ['最终正文']);
  assert.equal(state.finishes(), 1);
  for (const cleanup of state.cleanups) cleanup?.();
  assert.equal(state.listeners.size, 0);
});
