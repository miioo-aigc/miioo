import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parse } from 'acorn';
import { transformWithOxc } from 'vite';
import * as protocol from '../src/components/canvas/CanvasNodeResults.js';

// 无浏览器测试：执行真实组件及事件回调，以最小钩子宿主模拟重渲染和副作用。
const source = await readFile(new URL('../src/components/canvas/CanvasNodeResultsPopover.jsx', import.meta.url), 'utf8');
const css = await readFile(new URL('../src/components/canvas/CanvasNodeResultsPopover.css', import.meta.url), 'utf8');
const transformed = await transformWithOxc(source, 'CanvasNodeResultsPopover.jsx', { jsx: { runtime: 'automatic' } });
let active, cursor, states, effects, layouts;
const element = (type, props, key) => ({ type, props: props || {}, key });
const react = {
  useState(initial) {
    const slots = states.get(active) || [];
    states.set(active, slots);
    const index = cursor++;
    if (!(index in slots)) slots[index] = initial;
    return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }];
  },
  useRef(value) { return react.useState({ current: value })[0]; },
  useId() { return '名称-' + active + '-' + cursor++; },
  useEffect(callback) { effects.push(callback); },
  useLayoutEffect(callback) { layouts.push(callback); },
};
const imports = {
  react, 'react/jsx-runtime': { jsx: element, jsxs: element, Fragment: 'fragment' },
  'react-dom': { createPortal: value => value },
  'lucide-react': { Check: 'check', RefreshCw: 'refresh', Play: 'play', Pause: 'pause' },
  '../ui': { Button: 'button', IconButton: 'icon-button', ModalCloseButton: 'close-button' },
  '../ui/Radio': { default: 'radio' },
  '../feedback/MediaLoadStatus': { default: 'media-status' },
  './CanvasNodeResults.js': protocol,
  './CanvasAudioPlayer': { default: 'audio-player' },
  './CanvasNodeResultsPopover.css': {},
};
// 按语法树替换模块边界，保留真实组件主体，不依赖实验性虚拟机模块。
const syntax = parse(transformed.code, { ecmaVersion: 'latest', sourceType: 'module' });
const edits = [];
let defaultName;
for (const node of syntax.body) {
  if (node.type === 'ImportDeclaration') {
    const name = node.source.value;
    assert.ok(Object.hasOwn(imports, name), '意外依赖：' + name);
    const bindings = node.specifiers.map(specifier => {
      const imported = specifier.type === 'ImportDefaultSpecifier' ? 'default' : specifier.imported.name;
      return 'const ' + specifier.local.name + ' = imports[' + JSON.stringify(name) + '][' + JSON.stringify(imported) + '];';
    }).join(' ');
    edits.push({ start: node.start, end: node.end, text: bindings });
  } else if (node.type === 'ExportDefaultDeclaration') {
    defaultName = node.declaration.id.name;
    edits.push({ start: node.start, end: node.declaration.start, text: '' });
  }
}
assert.ok(defaultName);
let executable = transformed.code;
for (const edit of edits.reverse()) executable = executable.slice(0, edit.start) + edit.text + executable.slice(edit.end);
const Popover = new Function('imports', executable + String.fromCharCode(10) + 'return ' + defaultName + ';')(imports);
const assetId = '11111111-1111-4111-8111-111111111111';
function makeResults(type = 'text') {
  let state = protocol.createCanvasNodeResults();
  for (const time of [20, 10]) state = protocol.commitCanvasResultBatch(state, {
    id: '批次' + time, source: 'generation', requestedCount: 1, submittedAt: time, completedAt: time,
    results: [{ id: '结果' + time, index: 0, type, ...(type === 'text' ? { content: '正文' + time } : { assetId }) }],
  });
  return state;
}
function session(overrides = {}) {
  const localStates = new Map();
  const listeners = new Map();
  const focused = [];
  const panel = { style: {}, focus: () => focused.push('浮层'), getBoundingClientRect: () => ({
    width: Math.min(340, parseFloat(panel.style.maxWidth) || 340),
    height: Math.min(600, parseFloat(panel.style.maxHeight) || 600),
  }) };
  const trigger = { isConnected: true, focus: () => focused.push('入口') };
  const doc = { body: {}, activeElement: trigger,
    addEventListener: (name, callback) => listeners.set(name, callback),
    removeEventListener: name => listeners.delete(name) };
  globalThis.document = doc;
  globalThis.window = { innerWidth: 400, innerHeight: 600, addEventListener() {}, removeEventListener() {} };
  const props = { open: true, results: makeResults(), onSelect() {}, ...overrides };
  let nodes;
  function render() {
    states = localStates; effects = []; layouts = []; nodes = [];
    function visit(value, path = '根') {
      if (Array.isArray(value)) return value.map((child, index) => visit(child, path + '/' + index));
      if (!value || typeof value !== 'object') return value;
      if (typeof value.type === 'function') {
        active = path + ':' + value.type.name + ':' + (value.key ?? ''); cursor = 0;
        return visit(value.type(value.props), active);
      }
      nodes.push(value);
      if (value.props.ref) value.props.ref.current = panel;
      visit(value.props.children, path + '/' + value.type);
      return value;
    }
    visit(element(Popover, props));
    return nodes;
  }
  render();
  return { props, render, listeners, focused, effects: () => effects, layouts: () => layouts,
    find: type => nodes.filter(node => node.type === type),
    choose: () => nodes.filter(node => node.type === 'radio') };
}

test('统一列表按新到旧排列，浏览不切换，只有明确动作通知宿主', () => {
  const calls = [];
  const results = makeResults();
  const before = JSON.stringify(results);
  const ui = session({ results, onSelect: value => calls.push(value) });
  assert.equal(ui.find('div').filter(node => node.props.role === 'dialog').length, 1);
  assert.equal(ui.find('section').length, 0);
  assert.deepEqual(ui.find('div').filter(node => node.props.className === 'canvas-results-popover__text').map(node => node.props.children), ['正文20', '正文10']);
  assert.deepEqual(calls, []);
  ui.choose()[0].props.onChange();
  assert.deepEqual(calls, ['结果20']);
  assert.equal(JSON.stringify(results), before);
  assert.equal(ui.choose()[1].props.disabled, false);
  assert.equal(ui.choose()[0].props.name, ui.choose()[1].props.name);
  assert.deepEqual(ui.choose().map(node => node.props.value), ['结果20', '结果10']);
  assert.equal(ui.choose()[1].props.checked, true);
  ui.choose()[1].props.onChange();
  assert.deepEqual(calls, ['结果20']);
  assert.equal(ui.find('tab').length, 0);
});

test('图片、视频和音频跨批次共用两列网格，不渲染批次标题和时间', () => {
  for (const type of ['image', 'video', 'audio']) {
    const ui = session({ results: makeResults(type) });
    const grids = ui.find('div').filter(node => node.props.className === 'canvas-results-popover__grid');
    assert.equal(grids.length, 1);
    assert.deepEqual(grids[0].props.children.map(node => node.key), ['结果20', '结果10']);
    assert.equal(ui.find('article').length, 2);
    assert.equal(ui.find('section').length, 0);
    assert.equal(ui.find('h3').length, 0);
  }
});

test('卡片点击可选择，内部交互和文本选择不切换，未就绪及锁定仍禁选', () => {
  const selected = [];
  const ui = session({ results: makeResults('image'),
    mediaByResultId: { '结果20': { status: 'ready', src: '/image.png' } },
    onSelect: id => selected.push(id) });
  window.getSelection = () => ({ toString: () => '' });
  const click = () => ui.find('article')[0].props.onClick({ target: { closest: () => null } });
  click();
  assert.deepEqual(selected, []);
  ui.find('img')[0].props.onLoad(); ui.render();
  click();
  assert.deepEqual(selected, ['结果20']);
  ui.find('article')[0].props.onClick({ target: { closest: selector => {
    for (const excluded of ['button', 'video', '.canvas-node__transcript', '.canvas-results-popover__selection']) assert.ok(selector.includes(excluded));
    return {};
  } } });
  window.getSelection = () => ({ toString: () => '选中文字' });
  click();
  window.getSelection = () => null;
  ui.props.generating = true; ui.render(); click();
  assert.deepEqual(selected, ['结果20']);
});

test('生成、编辑、依赖保护和切换等待均拦截显式切换回调', () => {
  for (const flag of ['generating', 'editing', 'upstreamProtected', 'selectionPending']) {
    let count = 0;
    const ui = session({ [flag]: true, onSelect: () => count++ });
    assert.ok(ui.choose().every(node => node.props.disabled));
    ui.choose()[0].props.onChange();
    assert.equal(count, 0);
  }
});

test('不可用、解析中、解析失败和本体未加载的素材不能选择', () => {
  for (const media of [undefined, { status: 'unavailable' }, { status: 'loading' }, { status: 'error' }, { status: 'ready', src: '/图片.png' }]) {
    const ui = session({ results: makeResults('image'), mediaByResultId: { '结果20': media } });
    assert.equal(ui.choose()[0].props.disabled, true);
  }
});

test('图片本体成功才可选择，失败禁选，重试不切换定稿', () => {
  const selected = [], retried = [];
  const ui = session({ results: makeResults('image'), mediaByResultId: { '结果20': { status: 'ready', src: '/图片.png' } },
    onSelect: id => selected.push(id), onRetryMedia: id => retried.push(id) });
  ui.find('img')[0].props.onLoad(); ui.render();
  assert.equal(ui.choose()[0].props.disabled, false);
  ui.find('img')[0].props.onError(); ui.render();
  assert.equal(ui.choose()[0].props.disabled, true);
  ui.find('button').find(node => node.props['aria-label'] === '重试图片结果 1').props.onClick();
  ui.render();
  assert.deepEqual(retried, ['结果20']);
  assert.deepEqual(selected, []);
  assert.equal(ui.choose()[0].props.disabled, true);
  assert.equal(ui.find('img').length, 1);
});

test('音频历史支持试听，就绪后才允许恢复，失败禁止选择', () => {
  const selected = [];
  const ui = session({ results: makeResults('audio'),
    mediaByResultId: { '结果20': { status: 'ready', src: '/音频.mp3' } },
    onSelect: id => selected.push(id) });
  assert.equal(ui.find('audio-player').length, 1);
  assert.equal(ui.find('video').length, 0);
  assert.equal(ui.find('audio-player')[0].props.compact, true);
  assert.equal(ui.find('div').filter(node => node.props.className === 'canvas-results-popover__grid').length, 1);
  assert.equal(ui.choose()[0].props.disabled, true);
  ui.find('audio-player')[0].props.onReady(); ui.render();
  ui.choose()[0].props.onChange();
  assert.deepEqual(selected, ['结果20']);
  ui.find('audio-player')[0].props.onError(); ui.render();
  assert.equal(ui.choose()[0].props.disabled, true);
});

test('历史音频复用紧凑播放器并传递所属结果的配音文本', () => {
  const ui = session({ results: makeResults('audio'),
    mediaByResultId: { '结果20': { status: 'ready', src: '/audio.mp3', transcript: '历史配音文本' } } });
  const player = ui.find('audio-player')[0];
  assert.equal(player.props.url, '/audio.mp3');
  assert.equal(player.props.transcript, '历史配音文本');
  assert.equal(player.props.compact, true);
  assert.match(css, /canvas-node__transcript/);
});

test('文本完整保留且可聚焦，视频使用独立控件和本体就绪事件', () => {
  const text = session();
  assert.equal(text.find('div').filter(node => node.props.className === 'canvas-results-popover__text').length, 2);
  const video = session({ results: makeResults('video'), mediaByResultId: { '结果20': { status: 'ready', src: '/视频.mp4' } } });
  assert.equal(video.find('video')[0].props.controls, true);
  assert.equal(video.find('video')[0].props.preload, 'metadata');
  assert.equal(video.choose()[0].props.disabled, true);
  assert.equal(video.find('div').filter(node => node.props.className === 'canvas-results-popover__video-loading').length, 1);
  assert.match(css, /.canvas-results-popover__video-loading {[^}]*pointer-events: none/);
  assert.ok(css.includes('.canvas-results-popover__video-loading * { pointer-events: none; }'));
  video.find('video')[0].props.onLoadedData(); video.render();
  assert.equal(video.choose()[0].props.disabled, false);
  assert.equal(video.find('div').filter(node => node.props.className === 'canvas-results-popover__video-loading').length, 0);
});

test('加载、失败、空态及分页只使用受控状态和真实回调', () => {
  assert.equal(session({ open: false }).find('div').length, 0);
  assert.equal(session({ loading: true }).find('section').length, 0);
  assert.equal(session({ error: '读取失败' }).find('section').length, 0);
  assert.equal(session({ results: protocol.createCanvasNodeResults() }).find('section').length, 0);
  let count = 0;
  const ui = session({ hasMore: true, onLoadMore: () => count++ });
  assert.equal(count, 0);
  ui.find('button').find(node => node.props.children === '加载更多结果').props.onClick();
  assert.equal(count, 1);
  assert.equal(session({ hasMore: true, loadingMore: true }).find('button').at(-1).props.disabled, true);
});

test('退出键关闭并清理监听，焦点返回入口，指针滚轮不传入画布', () => {
  let closed = 0, stopped = 0;
  const ui = session({ onClose: () => closed++ });
  const cleanups = ui.effects().map(effect => effect());
  assert.deepEqual(ui.focused, ['浮层']);
  ui.listeners.get('keydown')({ key: 'Escape', preventDefault() {}, stopPropagation() { stopped++; } });
  assert.equal(closed, 1);
  const root = ui.find('div')[0];
  for (const event of ['onPointerDown', 'onMouseDown', 'onWheel', 'onDoubleClick', 'onKeyDown']) {
    root.props[event]({ stopPropagation() { stopped++; } });
  }
  assert.equal(stopped, 6);
  cleanups.forEach(cleanup => cleanup?.());
  assert.deepEqual(ui.focused, ['浮层', '入口']);
  assert.equal(ui.listeners.size, 0);
});

test('浮层宽340高600且约束视口，图片完整展示并保持两列', () => {
  const ui = session({ anchorRect: { left: 900, top: 580, bottom: 600 } });
  const cleanup = ui.layouts()[0](); ui.render();
  assert.equal(ui.find('div')[0].props.style.left, 48);
  assert.ok(ui.find('div')[0].props.style.top >= 12);
  cleanup?.();
  assert.match(css, /position: fixed/);
  assert.match(css, /object-fit: contain/);
  assert.match(css, /max-width: 480px/);
  assert.match(css, /100dvh - 24px/);
  assert.ok(css.includes('width: min(340px,'));
  assert.match(css, /height: 600px;/);
  assert.ok(css.includes('grid-template-columns: repeat(2, minmax(0, 1fr))'));
  assert.doesNotMatch(css.slice(css.indexOf('@media')), /grid-template-columns/);
});

test('全部结果的复选框悬浮右上角，不占内容布局', () => {
  assert.match(css, /.canvas-results-popover__selection { position: absolute; top: 8px; right: 8px; z-index: 2; }/);
  assert.doesNotMatch(css, /padding: 30px 8px 8px/);
});

test('浮窗优先在入口右侧，右侧不足时回退左侧', () => {
  const ui = session({ anchorRect: { left: 100, right: 132, top: 80 } });
  window.innerWidth = 1200; window.innerHeight = 900;
  ui.layouts()[0](); ui.render();
  assert.equal(ui.find('div')[0].props.style.left, 140);
  assert.equal(ui.find('div')[0].props.style.top, 80);
  ui.props.anchorRect = { left: 1100, right: 1132, top: 80 };
  ui.render(); ui.layouts()[0](); ui.render();
  assert.equal(ui.find('div')[0].props.style.left, 752);
  assert.equal(ui.find('div')[0].props.style.top, 80);
  assert.ok(css.includes('aspect-ratio: 1 / 1'));
});

test('放大及可视视口偏移后尺寸和右下边界使用同一约束', () => {
  const ui = session({ anchorRect: { left: 950, top: 900, bottom: 920 } });
  const listeners = new Map();
  const viewport = { width: 280, height: 220, offsetLeft: 100, offsetTop: 80,
    addEventListener: (name, fn) => listeners.set(name, fn),
    removeEventListener: name => listeners.delete(name) };
  globalThis.window.visualViewport = viewport;
  const cleanup = ui.layouts()[0](); ui.render();
  function check() {
    const { left, top, maxWidth, maxHeight } = ui.find('div')[0].props.style;
    assert.equal(maxWidth, viewport.width - 24);
    assert.equal(maxHeight, viewport.height - 24);
    assert.ok(left >= viewport.offsetLeft + 12);
    assert.ok(top >= viewport.offsetTop + 12);
    assert.ok(left + Math.min(340, maxWidth) <= viewport.offsetLeft + viewport.width - 12);
    assert.ok(top + Math.min(600, maxHeight) <= viewport.offsetTop + viewport.height - 12);
  }
  check();
  viewport.width = 200; viewport.height = 160;
  listeners.get('resize')(); ui.render(); check();
  viewport.offsetLeft = 140; viewport.offsetTop = 120;
  listeners.get('scroll')(); ui.render(); check();
  cleanup();
  assert.equal(listeners.size, 0);
});
