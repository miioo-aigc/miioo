import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parse } from 'acorn';
import { transformWithOxc } from 'vite';
import * as protocol from '../src/components/canvas/CanvasNodeResults.js';

const read = name => readFile(new URL('../src/components/canvas/' + name, import.meta.url), 'utf8');
const element = (type, props, key) => ({ type, props: props || {}, key });
let active;
let flowStore;
const react = {
  useState(initial) {
    const host = active, index = host.cursor++;
    if (!(index in host.slots)) host.slots[index] = initial;
    return [host.slots[index], value => { host.slots[index] = value; }];
  },
  useRef(value) { return react.useState({ current: value })[0]; },
  useId() { return react.useState('实例' + active.id)[0]; },
  useEffect(callback) { active.effects.push(callback); },
};
async function load(name, dependencies) {
  const source = await read(name);
  const { code } = await transformWithOxc(source, name, { jsx: { runtime: 'automatic' } });
  const imports = { react, 'react/jsx-runtime': { jsx: element, jsxs: element, Fragment: 'fragment' }, ...dependencies };
  const edits = [];
  let exported;
  for (const node of parse(code, { ecmaVersion: 'latest', sourceType: 'module' }).body) {
    if (node.type === 'ImportDeclaration') {
      assert.ok(Object.hasOwn(imports, node.source.value), node.source.value);
      edits.push({ start: node.start, end: node.end, text: node.specifiers.map(specifier => {
        const key = specifier.type === 'ImportDefaultSpecifier' ? 'default' : specifier.imported.name;
        return `const ${specifier.local.name} = imports[${JSON.stringify(node.source.value)}][${JSON.stringify(key)}];`;
      }).join(' ') });
    } else if (node.type === 'ExportDefaultDeclaration') {
      exported = node.declaration.id.name;
      edits.push({ start: node.start, end: node.declaration.start, text: '' });
    }
  }
  let body = code;
  for (const edit of edits.reverse()) body = body.slice(0, edit.start) + edit.text + body.slice(edit.end);
  return new Function('imports', body + '\nreturn ' + exported)(imports);
}
const Controls = await load('CanvasNodeResultControls.jsx', {
  '@xyflow/react': { useStoreApi: () => flowStore },
  'lucide-react': { History: 'history' }, '../ui': { IconButton: 'button', Tooltip: 'tooltip' },
  './CanvasNodeReplaceControl': { default: 'replace-control' },
  './CanvasNodeResultsPopover': { default: 'popover' }, './CanvasNodeResults.js': protocol,
  './CanvasNodeResultControls.css': {},
});

const shellDependencies = Object.fromEntries([
  '../feedback/ModelReadStatus', './CanvasCreationPanel', './CanvasCreationPresence', './CanvasNodeHeader',
  './CanvasNodePorts', './CanvasLocalUpload', './CanvasGenerationLoading', './CanvasConnectionPulse',
  './CanvasNodeToolbar', './CanvasNodeResultControls',
].map(name => [name, { default: name.split('/').at(-1) }]));
const Shell = await load('CanvasNodeShell.jsx', { ...shellDependencies,
  '../../hooks/useAvailableModels': { useAvailableModels: () => ({ models: [], loading: false }) },
  './CanvasTextModels': { getCanvasTextModels: () => [] },
  './UseCanvasMediaControls': { useCanvasMediaControls: () => ({ options: [], loading: false }) },
  './UseCanvasMediaSize': { useCanvasMediaSize: () => null }, './canvas-nodes.css': {},
});
let nextId = 0;
function host(Component, props) {
  const state = { id: nextId++, slots: [], effects: [], cursor: 0 };
  let nodes;
  function render() {
    active = state; state.cursor = 0; state.effects = []; nodes = [];
    function visit(value) {
      if (Array.isArray(value)) return value.forEach(visit);
      if (!value || typeof value !== 'object') return;
      if (typeof value.type === 'function') return visit(value.type(value.props || {}));
      nodes.push(value); visit(value.props?.children);
    }
    visit(Component(props));
  }
  render();
  return { props, render, mount: () => state.effects.map(callback => callback()),
    find: type => nodes.filter(node => node.type === type),
    class: name => nodes.find(node => node.props?.className?.split(' ').includes(name)) };
}
const assetId = '11111111-1111-4111-8111-111111111111';
function data(type = 'text', resultCount = 2) {
  let nodeResults = protocol.createCanvasNodeResults();
  for (let index = 0; index < resultCount; index += 1) {
    const last = index === resultCount - 1;
    nodeResults = protocol.commitCanvasResultBatch(nodeResults, {
      id: '批次' + index, source: 'generation', requestedCount: 1, submittedAt: index + 1, completedAt: index + 1,
      results: [{ id: last ? '结果' : '历史结果' + index, index: 0, type, ...(type === 'text' ? { content: '文本' } : { assetId }) }],
    });
  }
  return { nodeId: '节点', nodeResults };
}
function environment() {
  let state = { transform: [0, 0, 1], nodeLookup: new Map([['节点', { internals: { positionAbsolute: { x: 0, y: 0 } } }]]) };
  const subscribers = new Set();
  flowStore = {
    getState: () => state,
    subscribe: listener => { subscribers.add(listener); return () => subscribers.delete(listener); },
    update: update => { state = { ...state, ...update }; subscribers.forEach(listener => listener(state)); },
    subscribers,
  };
  globalThis.window = new EventTarget();
  const listeners = new Set();
  const add = window.addEventListener.bind(window), remove = window.removeEventListener.bind(window);
  window.addEventListener = (type, listener) => { listeners.add(listener); add(type, listener); };
  window.removeEventListener = (type, listener) => { listeners.delete(listener); remove(type, listener); };
  return listeners;
}
const click = ui => ui.find('button')[0].props.onClick({ currentTarget: { getBoundingClientRect: () => ({ left: 30, top: 40, bottom: 72 }) } });

test('只有一条结果不显示历史入口，两条结果才显示', () => {
  environment();
  const single = host(Controls, { data: data('image', 1), nodeType: 'image' });
  assert.equal(single.find('button').length, 0);
  const multiple = host(Controls, { data: data('image', 2), nodeType: 'image' });
  assert.equal(multiple.find('button').length, 1);
  assert.match(multiple.find('button')[0].props['aria-label'], /查看.*结果（2）/);
});
test('入口使用真实屏幕锚点，选择仅转发节点编号和结果编号', () => {
  environment();
  const calls = [], node = data();
  node.onSelectResult = (...args) => calls.push(args);
  const before = JSON.stringify(node.nodeResults);
  const ui = host(Controls, { data: node, title: '文字节点', nodeType: 'image' }); ui.mount();
  assert.equal(ui.find('popover')[0].props.open, false);
  assert.match(ui.find('button')[0].props['aria-label'], /文字节点/);
  click(ui); ui.render();
  const popover = ui.find('popover')[0].props;
  assert.equal(popover.open, true);
  assert.deepEqual(popover.anchorRect, { left: 30, right: undefined, top: 40, bottom: 72 });
  assert.deepEqual(calls, []);
  popover.onSelect('结果');
  assert.deepEqual(calls, [['节点', '结果']]);
  assert.equal(JSON.stringify(node.nodeResults), before);
  popover.onClose(); ui.render();
  assert.equal(ui.find('popover')[0].props.open, false);
});

test('打开媒体详情关闭历史，重渲染不恢复，卸载清理监听', () => {
  const listeners = environment();
  const ui = host(Controls, { data: data('image'), nodeType: 'image' });
  const cleanup = ui.mount();
  click(ui); ui.render();
  assert.equal(ui.find('popover')[0].props.open, true);
  window.dispatchEvent(new CustomEvent('canvas-media-preview-open'));
  ui.render();
  assert.equal(ui.find('popover')[0].props.open, false);
  ui.render();
  assert.equal(ui.find('popover')[0].props.open, false);
  cleanup.forEach(callback => callback?.());
  assert.equal(listeners.size, 0);
});

test('打开另一节点关闭原浮层，卸载清理自定义事件监听', () => {
  const listeners = environment();
  const first = host(Controls, { data: data('image'), nodeType: 'image' }), second = host(Controls, { data: data('image'), nodeType: 'image' });
  const cleanup = [...first.mount(), ...second.mount()];
  click(first); first.render();
  assert.equal(first.find('popover')[0].props.open, true);
  click(second); second.render(); first.render();
  assert.equal(first.find('popover')[0].props.open, false);
  assert.equal(second.find('popover')[0].props.open, true);
  cleanup.forEach(callback => callback?.());
  assert.equal(listeners.size, 0);
});

test('视口平移缩放、节点及父分组移动关闭浮层，无关状态不关闭，清理订阅', () => {
  for (const update of [
    { transform: [20, 0, 1] },
    { transform: [0, 30, 1] },
    { transform: [0, 0, 2] },
    { nodeLookup: new Map([['节点', { internals: { positionAbsolute: { x: 40, y: 50 } } }]]) },
    { nodeLookup: new Map() },
  ]) {
    environment();
    const ui = host(Controls, { data: data('image'), nodeType: 'image' });
    const closedCleanup = ui.mount();
    assert.equal(flowStore.subscribers.size, 0);
    closedCleanup.forEach(cleanup => cleanup?.());
    click(ui); ui.render();
    const cleanup = ui.mount();
    assert.equal(flowStore.subscribers.size, 1);
    flowStore.update({ transform: [0, 0, 1], unrelated: true }); ui.render();
    assert.equal(ui.find('popover')[0].props.open, true);
    flowStore.update(update); ui.render();
    assert.equal(ui.find('popover')[0].props.open, false);
    cleanup.forEach(dispose => dispose?.());
    assert.equal(flowStore.subscribers.size, 0);
  }
});

test('按资产编号适配预览，拒绝其他当前素材和不可用地址', () => {
  environment();
  const node = data('video');
  node.asset = { asset_id: '其他', url: '/wrong' };
  const ui = host(Controls, { data: node, nodeType: 'video' });
  assert.equal(ui.find('popover')[0].props.mediaByResultId['结果'].status, 'unavailable');
  node.asset = { asset_id: assetId, url: '/current', posterUrl: '/poster' }; ui.render();
  assert.equal(ui.find('popover')[0].props.mediaByResultId['结果'].src, '/current');
  node.resultAssetViews = { [assetId]: { availability: 'forbidden', url: '/forbidden' } }; ui.render();
  assert.equal(ui.find('popover')[0].props.mediaByResultId['结果'].src, undefined);
  node.resultAssetViews[assetId] = { availability: 'trashed', url: '/history', posterUrl: '/poster' }; ui.render();
  assert.deepEqual(ui.find('popover')[0].props.mediaByResultId['结果'], { status: 'ready', src: '/history', poster: '/poster', message: undefined, transcript: undefined });
});

test('生成仍可浏览，所有保护阻止切换，提交锁定关闭并禁用入口', () => {
  environment();
  for (const flag of ['generating', 'editing', 'upstreamProtected', 'selectionPending', 'submissionLocked']) {
    let calls = 0;
    const node = { ...data('image'), onSelectResult: () => calls++ };
    const ui = host(Controls, { data: node, nodeType: 'image' }); click(ui); ui.render();
    const select = ui.find('popover')[0].props.onSelect;
    node[flag] = true; ui.render();
    select('结果');
    assert.equal(calls, 0);
    assert.equal(ui.find('popover')[0].props.open, flag !== 'submissionLocked');
    assert.equal(ui.find('button')[0].props.disabled, flag === 'submissionLocked');
  }
});

test('上游标识来自受控数据；缺少结果和回调不伪造业务状态', () => {
  environment();
  const ui = host(Controls, { data: { upstreamUpdated: true } });
  assert.equal(ui.find('button').length, 0);
  assert.equal(ui.find('popover').length, 0);
  assert.equal(ui.find('span').length, 0);
  const withResults = host(Controls, { data: data('image'), nodeType: 'image' });
  assert.equal(withResults.find('popover')[0].props.onSelect, undefined);
  let stopped = 0;
  withResults.find('div')[0].props.onPointerDown({ stopPropagation: () => stopped++ });
  withResults.find('div')[0].props.onWheel({ stopPropagation: () => stopped++ });
  assert.equal(stopped, 2);
});

test('上游标识改由标题行承载，壳层按受控数据透传到节点标题', () => {
  environment();
  const shell = host(Shell, { nodeType: 'image', data: { ...data('image'), upstreamUpdated: true }, children: element('old-result', {}) });
  assert.equal(shell.find('CanvasNodeHeader')[0].props.upstreamUpdated, true);
  const clear = host(Shell, { nodeType: 'image', data: data('image'), children: element('old-result', {}) });
  assert.equal(clear.find('CanvasNodeHeader')[0].props.upstreamUpdated, false);
});

test('文本不显示历史或替换；媒体替换按保护状态禁用，提交锁定两个入口', () => {
  environment();
  const text = host(Controls, { data: data('text'), nodeType: 'text' });
  assert.equal(text.find('replace-control').length, 0);
  const image = host(Controls, { data: data('image'), nodeType: 'image' });
  assert.equal(image.find('button').length, 1);
  const locked = { ...data('audio'), asset: { url: '/audio.mp3' }, generating: true };
  const audio = host(Controls, { data: locked, nodeType: 'audio' });
  assert.equal(audio.find('replace-control')[0].props.disabled, true);
  assert.equal(audio.find('button')[0].props.disabled, false);
  locked.submissionLocked = true; audio.render();
  assert.equal(audio.find('button').every(button => button.props.disabled), true);
  assert.equal(audio.class('canvas-node-result-controls').props.style['--canvas-result-inverse-zoom'], 1);
  locked.viewportZoom = 0.5; audio.render();
  assert.equal(audio.class('canvas-node-result-controls').props.style['--canvas-result-inverse-zoom'], 1);
  locked.viewportZoom = 2; audio.render();
  assert.equal(audio.class('canvas-node-result-controls').props.style['--canvas-result-inverse-zoom'], 0.5);
});

test('替换入口按媒体节点显示并受生成、锁定和缩放约束', () => {
  environment();
  for (const nodeType of ['text', 'image', 'video', 'audio']) {
    const node = { ...data(nodeType), asset: { url: '/media' }, viewportZoom: 2 };
    const ui = host(Controls, { data: node, nodeType });
    assert.equal(ui.find('replace-control').length, nodeType === 'text' ? 0 : 1);
    assert.equal(ui.class('canvas-node-result-controls').props.style['--canvas-result-inverse-zoom'], 0.5);
    node.submissionLocked = true; ui.render();
    if (nodeType !== 'text') assert.equal(ui.find('replace-control')[0].props.disabled, true);
    assert.ok(ui.find('button').every(button => button.props.disabled));
  }
  for (const extra of [{ generating: true }, { generationPending: true }, { outputLocked: true },
    { editing: true }, { upstreamProtected: true }, { pendingCanvasUpload: { asset: { uploadStatus: 'uploading' } } }]) {
    const ui = host(Controls, { data: { ...data('image'), asset: { url: '/image.png' }, ...extra }, nodeType: 'image' });
    assert.equal(ui.find('replace-control')[0].props.disabled, true);
    assert.equal(ui.find('button')[0].props.disabled, false);
    assert.equal(ui.find('popover')[0].props.selectionPending, Boolean(extra.pendingCanvasUpload));
  }
});

test('空媒体卡片不显示替换，内容出现后显示，移除内容后隐藏', () => {
  environment();
  for (const nodeType of ['image', 'video', 'audio']) {
    const node = data(nodeType);
    const ui = host(Controls, { data: node, nodeType });
    assert.equal(ui.find('replace-control').length, 0);
    assert.equal(ui.find('button').length, 1);
    node.asset = { url: '/media' }; ui.render();
    assert.equal(ui.find('replace-control').length, 1);
    node.asset = null; ui.render();
    assert.equal(ui.find('replace-control').length, 0);
    assert.equal(ui.find('button').length, 1);
  }
});

test('壳层接入控件，生成仅隐藏旧内容和上传槽，提示词参数草稿不锁死', () => {
  const node = { ...data(), generating: true, creationPanelOpen: true };
  const ui = host(Shell, { nodeType: 'image', data: node, selected: true, children: element('old-result', {}) });
  assert.equal(ui.find('CanvasNodeResultControls')[0].props.data, node);
  const frameChildren = ui.class('canvas-node__frame').props.children.flat(Infinity);
  assert.ok(frameChildren.includes(ui.find('CanvasNodeResultControls')[0]));
  assert.equal(ui.find('div')[0].props.inert, false);
  assert.equal(ui.class('canvas-node__result-body').props['aria-hidden'], true);
  assert.equal(ui.class('canvas-node__result-body').props.inert, true);
  assert.equal(ui.class('canvas-node__local-upload-slot').props.hidden, true);
  assert.equal(ui.find('CanvasLocalUpload').length, 1);
  assert.equal(ui.find('CanvasGenerationLoading').length, 1);
  assert.equal(ui.find('fieldset')[0].props.disabled, true);
  assert.equal(ui.find('CanvasCreationPanel')[0].props.generating, true);
  assert.equal(ui.class('canvas-creation-scale').props.inert, undefined);
  node.generating = false; ui.render();
  assert.equal(ui.class('canvas-node__result-body').props['aria-hidden'], false);
  assert.equal(ui.find('fieldset')[0].props.disabled, false);
});

test('提交锁定拦截当前节点输入，工具栏原回调及样式类保持', () => {
  const action = () => {};
  const node = { submissionLocked: true, onToolbarAction: action };
  const ui = host(Shell, { nodeType: 'text', data: node });
  const root = ui.find('div')[0];
  assert.equal(root.props.inert, true);
  let prevented = 0, stopped = 0;
  for (const name of ['onPointerDownCapture', 'onClickCapture', 'onDoubleClickCapture', 'onKeyDownCapture']) {
    root.props[name]({ preventDefault: () => prevented++, stopPropagation: () => stopped++ });
  }
  assert.equal(prevented, 4); assert.equal(stopped, 4);
  assert.equal(ui.find('CanvasNodeToolbar')[0].props.onAction, action);
  assert.ok(ui.class('canvas-node__toolbar-scale'));
});
