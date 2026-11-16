import test from 'node:test';
import assert from 'node:assert/strict';
import { Schema } from '@tiptap/pm/model';
import { EditorState, TextSelection } from '@tiptap/pm/state';
import { createEditorHistoryPlugin, editorHistoryCommand } from '../src/components/script/EditorHistory.js';
const schema = new Schema({ nodes: { doc: { content: 'paragraph+' }, paragraph: { content: 'text*' }, text: {} }, marks: { bold: {} } });
const createState = () => EditorState.create({ schema, plugins: [createEditorHistoryPlugin(10)] });
const run = (state, direction) => {
  let next = state;
  const available = editorHistoryCommand(direction)(state, (tr) => { next = state.apply(tr); });
  return { next, available };
};
test('最多撤销十步，重做恢复十步', () => {
  let state = createState();
  for (let i = 0; i < 12; i++) state = state.apply(state.tr.insertText('a'));
  for (let i = 0; i < 10; i++) {
    const result = run(state, 'undo');
    assert.equal(result.available, true);
    state = result.next;
  }
  assert.equal(state.doc.textContent, 'aa');
  assert.equal(run(state, 'undo').available, false);
  for (let i = 0; i < 10; i++) state = run(state, 'redo').next;
  assert.equal(state.doc.textContent, 'a'.repeat(12));
  assert.equal(run(state, 'redo').available, false);
});
test('恢复格式和选区，移动光标不计步，新编辑清空重做', () => {
  let state = createState();
  assert.equal(run(state, 'undo').available, false);
  state = state.apply(state.tr.insertText('hello'));
  state = state.apply(state.tr.setSelection(TextSelection.create(state.doc, 1, 6)));
  state = state.apply(state.tr.addMark(1, 6, schema.marks.bold.create()));
  state = run(state, 'undo').next;
  assert.equal(state.doc.firstChild.firstChild.marks.length, 0);
  assert.equal(state.selection.from, 1);
  assert.equal(state.selection.to, 6);
  state = run(state, 'redo').next;
  assert.equal(state.doc.firstChild.firstChild.marks[0].type.name, 'bold');
  state = run(state, 'undo').next;
  state = state.apply(state.tr.insertText('new'));
  assert.equal(run(state, 'redo').available, false);
  state = run(state, 'undo').next;
  assert.equal(state.doc.textContent, 'hello');
});
test('同一次输入法组合只占一步', () => {
  let state = createState();
  state = state.apply(state.tr.insertText('n').setMeta('composition', 1));
  state = state.apply(state.tr.insertText('你', 1, 2).setMeta('composition', 1));
  state = run(state, 'undo').next;
  assert.equal(state.doc.textContent, '');
  assert.equal(run(state, 'undo').available, false);
  state = run(state, 'redo').next;
  assert.equal(state.doc.textContent, '你');
});
test('Tiptap 命令修改共享事务，can 检查不改变文档', () => {
  let state = createState();
  state = state.apply(state.tr.insertText('hello'));
  const dryRun = state.tr;
  assert.equal(editorHistoryCommand('undo', dryRun)(state), true);
  assert.equal(dryRun.docChanged, false);
  const commandTr = state.tr;
  editorHistoryCommand('undo', commandTr)(state, () => {});
  state = state.apply(commandTr);
  assert.equal(state.doc.textContent, '');
  assert.equal(run(state, 'redo').next.doc.textContent, 'hello');
});
