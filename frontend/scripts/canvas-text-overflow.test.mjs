import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const source = readFileSync(new URL('../src/components/canvas/UseCanvasTextOverflow.js', import.meta.url), 'utf8');
function mount(editing = false) {
  const listeners = new Map();
  const element = { dataset: {}, scrollHeight: 500, clientHeight: 238, scrollTop: 0, children: [{}],
    addEventListener: (event, fn) => listeners.set(event, fn), removeEventListener: (event) => listeners.delete(event) };
  const observers = [];
  class Observer {
    constructor(callback) { this.callback = callback; this.disconnected = false; observers.push(this); }
    observe() { this.disconnected = false; }
    disconnect() { this.disconnected = true; }
  }
  let cleanup;
  const context = vm.createContext({ ResizeObserver: Observer, MutationObserver: Observer,
    useLayoutEffect: (effect) => { cleanup = effect(); } });
  const body = source.slice(source.indexOf('/**')).replace('export function', 'function');
  vm.runInContext(body, context);
  context.useCanvasTextOverflow({ current: element }, editing);
  return { element, listeners, observers, cleanup };
}

test('有下文渐隐、滚动到底移除提示，向上滚动恢复', () => {
  const { element, listeners } = mount();
  assert.equal(element.dataset.hasMore, 'true');
  element.scrollTop = 262;
  listeners.get('scroll')();
  assert.equal(element.dataset.hasMore, 'false');
  element.scrollTop = 100;
  listeners.get('scroll')();
  assert.equal(element.dataset.hasMore, 'true');
});

test('内容和尺寸改变重新测量，清理监听与渐隐状态', () => {
  const { element, observers, listeners, cleanup } = mount();
  element.scrollHeight = 200;
  observers[1].callback();
  assert.equal(element.dataset.hasMore, 'false');
  element.scrollHeight = 600;
  observers[0].callback();
  assert.equal(element.dataset.hasMore, 'true');
  cleanup();
  assert.equal(element.dataset.hasMore, undefined);
  assert.equal(listeners.size, 0);
  assert.ok(observers.every((observer) => observer.disconnected));
});

test('编辑状态不施加渐隐，底部裁切与渐隐样式存在', () => {
  const { element, observers, listeners } = mount(true);
  assert.equal(element.dataset.hasMore, undefined);
  assert.equal(observers.length, 0);
  assert.equal(listeners.size, 0);
  const css = readFileSync(new URL('../src/components/canvas/canvas-nodes.css', import.meta.url), 'utf8');
  assert.ok(css.includes('clip-path: inset(0 0 4px)'));
  assert.ok(css.includes('mask-image: linear-gradient(to bottom'));
  assert.ok(css.includes('calc(100% - 36px), transparent calc(100% - 4px)'));
});
