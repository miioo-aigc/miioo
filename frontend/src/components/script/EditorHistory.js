import { Extension } from '@tiptap/core';
import { Plugin, PluginKey, Selection } from '@tiptap/pm/state';

const historyKey = new PluginKey('boundedEditorHistory');
const snapshot = (state) => ({ doc: state.doc, selection: state.selection.toJSON() });

// 每个文档编辑事务记录一步，完整保留富文本和选区，严格限制历史数量。
export function createEditorHistoryPlugin(limit = 10) {
  return new Plugin({
    key: historyKey,
    state: {
      init: () => ({ past: [], future: [] }),
      apply(tr, history, oldState) {
        const direction = tr.getMeta(historyKey);
        if (direction === 'undo') return {
          past: history.past.slice(0, -1),
          future: [...history.future, snapshot(oldState)].slice(-limit),
        };
        if (direction === 'redo') return {
          past: [...history.past, snapshot(oldState)].slice(-limit),
          future: history.future.slice(0, -1),
        };
        if (!tr.docChanged || tr.doc.eq(oldState.doc)) return history;
        const composition = tr.getMeta('composition');
        // 同一次中文输入法组合只记录一步，避免撤销到拼音中间态。
        const sameComposition = composition != null && composition === history.composition;
        return {
          past: sameComposition ? history.past : [...history.past, snapshot(oldState)].slice(-limit),
          future: [], composition,
        };
      },
    },
  });
}

export function editorHistoryCommand(direction, transaction) {
  return (state, dispatch) => {
    const history = historyKey.getState(state);
    const target = (direction === 'undo' ? history?.past : history?.future)?.at(-1);
    if (!target) return false;
    if (dispatch) {
      const tr = (transaction || state.tr).replaceWith(0, state.doc.content.size, target.doc.content);
      tr.setSelection(Selection.fromJSON(tr.doc, target.selection));
      dispatch(tr.setMeta(historyKey, direction).scrollIntoView());
    }
    return true;
  };
}

export const EditorHistory = Extension.create({
  name: 'boundedEditorHistory',
  addOptions: () => ({ depth: 10 }),
  addProseMirrorPlugins() { return [createEditorHistoryPlugin(this.options.depth)]; },
  addCommands() {
    return {
      undo: () => ({ state, dispatch, tr }) => editorHistoryCommand('undo', tr)(state, dispatch),
      redo: () => ({ state, dispatch, tr }) => editorHistoryCommand('redo', tr)(state, dispatch),
    };
  },
  addKeyboardShortcuts() {
    return {
      'Mod-z': () => this.editor.commands.undo(),
      'Mod-Shift-z': () => this.editor.commands.redo(),
      'Mod-y': () => this.editor.commands.redo(),
    };
  },
});
