import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { createCanvasAutosave } from '../src/components/canvas/CanvasAutosave.js';

function setup() {
  const timers = new Map();
  const errors = [];
  let id = 0;
  const saver = createCanvasAutosave({
    schedule: (fn, delay) => { assert.equal(delay, 1000); timers.set(++id, fn); return id; },
    cancel: (key) => timers.delete(key), onError: (error) => errors.push(error),
  });
  const tick = async () => {
    const jobs = [...timers.values()]; timers.clear();
    jobs.forEach((fn) => fn());
    for (let i = 0; i < 10; i++) await Promise.resolve();
  };
  return { saver, timers, errors, tick };
}

test('实际Hook接线：刷新保护、页面离开先保存、后退取消及清理', async () => {
  const source = readFileSync(new URL('../src/components/canvas/UseCanvasAutosave.js', import.meta.url), 'utf8')
    .replace(/^import .*;$/gm, '').replace('export function', 'function');
  const effects = [];
  const listeners = new Map();
  const ref = { current: null };
  const messages = [];
  let restored = '';
  const use = runInNewContext(source + ';useCanvasAutosave', {
    useState: () => ['idle', () => {}], useLayoutEffect: (fn) => effects.push(fn), useRef: () => ref, createCanvasAutosave,
    serializeCanvasDocument: (nodes) => ({ nodes }),
    showGlobalToast: (...args) => messages.push(args),
    window: { location: { href: '/canvas/a' }, confirm: () => false, history: { pushState: (_, __, url) => { restored = url; } },
      addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: (name) => listeners.delete(name) },
  });
  const acknowledgeRef = { current: null };
  const hook = use({ enabled: true, nodes: [], edges: [], viewport: {}, persist: async () => true, acknowledgeRef });
  const cleanup = effects[0](); effects[1]();
  ref.current.update('edited', true, async () => { ref.current.acknowledge('edited'); return true; });
  let prevented = false;
  listeners.get('beforeunload')({ preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  let stopped = false;
  listeners.get('popstate')({ stopImmediatePropagation() { stopped = true; } });
  assert.equal(stopped, true); assert.equal(restored, '/canvas/a');
  let left = false;
  await hook.leave(() => { left = true; });
  assert.equal(left, true); assert.equal(ref.current.dirty(), false);
  assert.equal(messages.length, 1);
  cleanup(); assert.equal(listeners.size, 0);
});

test('初始加载不保存，连续编辑合并为一秒后保存最新内容', async () => {
  const { saver, timers, tick } = setup();
  const saved = [];
  const update = (key) => saver.update(key, true, async () => { saved.push(key); saver.acknowledge(key); return true; });
  update('initial');
  assert.equal(timers.size, 0);
  update('node1'); update('node2');
  assert.equal(timers.size, 1);
  assert.equal(saver.dirty(), true);
  await tick();
  assert.deepEqual(saved, ['node2']);
  assert.equal(saver.dirty(), false);
  update('node2');
  assert.equal(timers.size, 0);
});

test('保存中继续编辑，旧响应不能清除新编辑；后续提交不并发', async () => {
  const { saver, tick } = setup();
  let release;
  let calls = 0;
  saver.update('initial', true, () => {});
  saver.update('first', true, async () => { calls++; await new Promise((resolve) => { release = resolve; }); saver.acknowledge('first'); return true; });
  await tick();
  saver.update('second', true, async () => { calls++; saver.acknowledge('second'); return true; });
  await tick();
  assert.equal(calls, 1);
  release();
  for (let i = 0; i < 10; i++) await Promise.resolve();
  assert.equal(saver.dirty(), true);
  await tick();
  assert.equal(calls, 2);
  assert.equal(saver.dirty(), false);
});

test('失败提示并保留未保存状态，主动重试成功才解除', async () => {
  const { saver, errors, tick, timers } = setup();
  let fails = true;
  saver.update('initial', true, () => {});
  saver.update('edited', true, async () => {
    if (fails) throw new Error('断网');
    saver.acknowledge('edited'); return true;
  });
  await tick();
  assert.equal(errors.length, 1);
  assert.equal(saver.dirty(), true);
  assert.equal(timers.size, 0);
  fails = false;
  assert.equal(await saver.flush(), true);
  assert.equal(saver.dirty(), false);
});

test('上传或生成未就绪不保存，恢复就绪后补存；销毁后不提交', async () => {
  const { saver, tick } = setup();
  let calls = 0;
  saver.update('initial', true, () => {});
  const save = async () => { calls++; saver.acknowledge('edited'); return true; };
  saver.update('edited', false, save);
  assert.equal(await saver.flush(), false);
  assert.equal(saver.dirty(), true);
  saver.update('edited', true, save);
  await tick();
  assert.equal(calls, 1);
  saver.update('new', true, save);
  saver.dispose();
  await tick();
  assert.equal(calls, 1);
});

test('状态绑定真实请求，成功保持一秒；新修改立即取消成功态', async () => {
  const states = []; const jobs = new Map(); let id = 0;
  const saver = createCanvasAutosave({ onState: (state) => states.push(state),
    schedule: (fn) => { jobs.set(++id, fn); return id; }, cancel: (key) => jobs.delete(key) });
  saver.update('initial', true, () => {});
  saver.update('edited', false, () => {});
  assert.equal(states.at(-1), 'pending');
  saver.start(); assert.equal(states.at(-1), 'saving');
  saver.acknowledge('edited'); assert.equal(states.at(-1), 'success');
  for (const fn of [...jobs.values()]) fn(); jobs.clear();
  assert.equal(states.at(-1), 'idle');
  saver.start(); saver.acknowledge('edited');
  saver.update('next', false, () => {});
  assert.equal(states.at(-1), 'pending'); assert.equal(jobs.size, 0);
  saver.start(); saver.fail(); assert.equal(states.at(-1), 'error');
  saver.update('next', false, () => {}); assert.equal(states.at(-1), 'error');
  saver.start(); assert.equal(states.at(-1), 'saving');
  saver.acknowledge('next'); assert.equal(states.at(-1), 'success');
  saver.dispose(); assert.equal(jobs.size, 0);
});

test('旧保存完成不能覆盖更新修改，销毁后迟到结果不能更新图标', () => {
  const states = [];
  const saver = createCanvasAutosave({ onState: (state) => states.push(state) });
  saver.update('initial', false, () => {});
  saver.update('first', false, () => {}); saver.start();
  saver.update('second', false, () => {}); saver.acknowledge('first');
  assert.equal(states.at(-1), 'pending');
  saver.start(); saver.dispose(); const count = states.length;
  saver.acknowledge('second'); saver.fail();
  assert.equal(states.length, count);
});
