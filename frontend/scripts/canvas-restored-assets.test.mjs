import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createCanvasNode } from '../src/components/canvas/canvasNodeUtils.js';
import { readCanvasDocument, serializeCanvasDocument } from '../src/components/canvas/CanvasDocument.js';

const source = readFileSync(new URL('../src/pages/CanvasPage.jsx', import.meta.url), 'utf8');
const start = source.indexOf('  const handleNodeAssetChange =');
const end = source.indexOf('  const addNode =', start);
assert.ok(start >= 0 && end > start);
const createActions = new Function('useCallback', 'uploadFilesRef', 'importAssetsRef',
  'cancelPendingClicks', 'setAssetTarget', 'setAssetPickerOpen',
  source.slice(start, end) + '; return { handleNodeAssetChange, handleNodeSelectAsset };');

function fixture() {
  const calls = [];
  const actions = createActions((fn) => fn,
    { current: (...args) => { calls.push(['upload', ...args]); return true; } },
    { current: (...args) => { calls.push(['import', ...args]); return true; } },
    () => calls.push(['cancel']), (target) => calls.push(['target', target]),
    (open) => calls.push(['open', open]));
  const node = readCanvasDocument(serializeCanvasDocument([createCanvasNode('image')])).nodes[0];
  assert.equal(node.data.onAssetChange, undefined);
  assert.equal(node.data.onSelectAsset, undefined);
  // 验证实际 React Flow 公共数据接线，而不是仅验证回调定义存在。
  const renderSource = source.split('nodes={presentation.nodes.map')[1];
  assert.ok(renderSource, '所有渲染节点应统一补齐素材动作');
  const binding = ['onAssetChange', 'onSelectAsset'].map((key) => {
    const match = renderSource.match(new RegExp(`\\b${key}:\\s*(handleNode\\w+)\\b`));
    assert.ok(match, `恢复节点应接入 ${key}`);
    return `${key}: ${match[1]}`;
  }).join(', ');
  const data = new Function('node', 'handleNodeAssetChange', 'handleNodeSelectAsset',
    'return { ...node.data, ' + binding + ' };')(node, actions.handleNodeAssetChange, actions.handleNodeSelectAsset);
  return { node, data, calls };
}

test('恢复的图片节点选择本地文件后，交给正式上传流程并保留目标节点', () => {
  const { node, data, calls } = fixture();
  const file = { name: '图片.png' };
  assert.equal(data.onAssetChange(node.id, [{ file, url: 'blob:preview' }]), true);
  assert.deepEqual(calls, [['upload', [file], { nodeId: node.id }]]);
});

test('恢复的图片节点点击资产库，清理延迟点击并打开指定类型弹窗', () => {
  const { node, data, calls } = fixture();
  data.onSelectAsset(node.id, 'image');
  assert.deepEqual(calls, [['cancel'], ['target', { nodeId: node.id, nodeType: 'image' }], ['open', true]]);
});

test('无本地文件的素材变更仍走现有回填，不重复上传', () => {
  const { node, data, calls } = fixture();
  const asset = { asset_type: 'image', url: 'https://example.test/image.png' };
  assert.equal(data.onAssetChange(node.id, asset), true);
  assert.deepEqual(calls, [['import', [asset], { nodeId: node.id }]]);
});

test('恢复节点的多个本地文件统一交给上传流程', () => {
  const { node, data, calls } = fixture();
  const files = [{ name: '第一张.png' }, { name: '第二张.png' }];
  assert.equal(data.onAssetChange(node.id, files.map((file) => ({ file, url: 'blob:preview' }))), true);
  assert.deepEqual(calls, [['upload', files, { nodeId: node.id }]]);
});
