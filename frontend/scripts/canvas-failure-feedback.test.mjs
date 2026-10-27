import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { getCanvasFailureReason } from '../src/components/canvas/CanvasFailureFeedback.js';

test('中文原因保留，底层异常转换为中文', () => {
  assert.equal(getCanvasFailureReason(new Error('画布文件超过100MB，无法导出')), '画布文件超过100MB，无法导出');
  assert.match(getCanvasFailureReason(new Error('Failed to fetch')), /网络/);
  assert.match(getCanvasFailureReason(new Error('opaque')), /未知错误/);
});

test('失败提示动作读取最新草稿，导出失败明确原因，切换画布隔离旧操作', async () => {
  const source = readFileSync(new URL('../src/components/canvas/UseCanvasFileActions.js', import.meta.url), 'utf8')
    .replace(/^import .*;$/gm, '').replace('export function', 'function');
  const refs = []; let cursor = 0; const effects = []; const layouts = []; const messages = []; const exported = [];
  const use = runInNewContext(source + ';useCanvasFileActions', {
    useRef: (initial) => refs[cursor++] ||= { current: initial }, useState: () => [null, () => {}],
    useCallback: (fn) => fn, useEffect: (fn) => effects.push(fn), useLayoutEffect: (fn) => layouts.push(fn),
    showGlobalToast: (...args) => messages.push(args), getCanvasFailureReason,
    serializeCanvasFile: async (nodes) => { exported.push(nodes); throw new Error('本地素材读取失败'); },
  });
  const render = (nodes) => { cursor = 0; const result = use({ nodes, name: '测试', canvasId: 'a' }); layouts.splice(0).forEach(fn => fn()); return result; };
  const first = render(['旧内容']); const cleanup = effects[0]();
  first.reportSaveError(new Error('断网')); const action = messages.at(-1)[2].action;
  assert.equal(action.label, '下载画布');
  render(['新内容']); await action.onClick();
  assert.deepEqual(exported, [['新内容']]);
  assert.equal(messages.at(-1)[0], '画布导出失败：本地素材读取失败');
  cleanup(); await action.onClick(); assert.equal(exported.length, 1);
});
