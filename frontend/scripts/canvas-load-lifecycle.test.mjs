import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createCanvasHistory } from '../src/components/canvas/CanvasHistory.js';

const source = readFileSync(new URL('../src/pages/CanvasPage.jsx', import.meta.url), 'utf8');
const match = source.match(/useEffect\(\(\) => \{\n    let cancelled = false;([\s\S]*?)\n  \}, \[([^\]]+)\]\);/);
assert.ok(match, '画布初始化副作用应存在');
const dependencies = match[2].split(',').map((value) => value.trim());
const names = ['canvasId', 'apiGetCanvasDocument', 'isDevelopmentCanvas', 'apiGetCurrentUser',
  'setError', 'setCanvas', 'readCanvasDocument', 'setNodes', 'setViewport',
  'setViewportZoom', 'setCanvasRevision', 'setCurrentUser', 'setLoadedCanvasId'];
const runEffect = new Function(...names, `let cancelled = false;${match[1]}`);
const flush = () => new Promise((resolve) => setImmediate(resolve));

test('初始化依赖稳定方法，节点更新及普通重渲染不会重复读取文档', async () => {
  assert.deepEqual(dependencies, ['canvasId', 'setNodes']);
  const history = createCanvasHistory();
  let requests = 0;
  let previous;
  let cleanup;
  const render = () => {
    const scope = { canvasId: 'canvas-a', ...history.getSnapshot(), ...history };
    const next = dependencies.map((name) => scope[name]);
    if (previous && next.every((value, index) => Object.is(value, previous[index]))) return;
    cleanup?.();
    previous = next;
    cleanup = runEffect(scope.canvasId, async () => { requests++; return {}; }, () => true,
      async () => ({}), () => {}, () => {}, () => ({ nodes: [], viewport: { zoom: 1 } }),
      history.setNodes, () => {}, () => {}, () => {}, () => {}, () => {});
  };
  const unsubscribe = history.subscribe(render);
  render();
  await flush();
  for (let index = 0; index < 10; index++) {
    history.setNodes([{ id: 'node', data: { content: String(index) } }]);
    render();
  }
  await flush();
  assert.equal(requests, 1);
  assert.equal(history.getSnapshot().nodes[0].data.content, '9');
  cleanup();
  unsubscribe();
  history.dispose();
});

test('卸载后到达的文档响应不回写页面或节点', async () => {
  let resolve;
  let writes = 0;
  const write = () => { writes++; };
  const cleanup = runEffect('canvas-a', () => new Promise((done) => { resolve = done; }),
    () => true, async () => ({}), write, write,
    () => ({ nodes: [], viewport: { zoom: 1 } }), write, write, write, write, write, write);
  cleanup();
  resolve({});
  await flush();
  assert.equal(writes, 0);
});
