import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
after(() => server.close());
const { useCompositionEditorStore: store, computeVisualWindows } = await server.ssrLoadModule('/src/stores/compositionEditorStore.js');

test('V1 吸附默认开启，A1 默认保持关闭', () => {
  assert.equal(store.getInitialState().trackSettings.V1.excludeGaps, true);
  assert.equal(store.getInitialState().trackSettings.A1.excludeGaps, false);
});

function setup(snap = false) {
  const segments = [
    { id: 'a', type: 'video', start: 0, duration: 3 },
    { id: 'audio', type: 'audio', start: 1, duration: 9 },
    { id: 'b', type: 'image', start: 3, duration: 3 },
    { id: 'subtitle', type: 'subtitle', start: 2, duration: 2 },
    { id: 'c', type: 'video', start: 6, duration: 3 },
  ];
  store.setState({ segments, selectedId: 'b', loaded: true, dirty: false, dirtyRev: 0, past: [], future: [], trackSettings: { V1: { excludeGaps: snap } } });
  return { segments, selectedId: 'b' };
}

const positions = () => computeVisualWindows(store.getState().segments).windows.map(({ seg, start }) => [seg.id, start]);

test('分离音频关闭原视频声音且只生成一次，允许切换选中并整体撤销', () => {
  const before = setup();
  store.setState({ segments: before.segments.map((seg) => ({ ...seg, assetId: seg.id })) });
  const original = store.getState().segments;
  store.getState().detachAudio('a');
  assert.equal(store.getState().segments.find((seg) => seg.id === 'a').hasAudio, false);
  assert.equal(store.getState().segments.length, original.length + 1);
  store.getState().detachAudio('a');
  assert.equal(store.getState().segments.length, original.length + 1);
  store.getState().select('c');
  assert.equal(store.getState().selectedId, 'c');
  store.getState().undo();
  assert.deepEqual(store.getState().segments, original);
  store.getState().redo();
  assert.equal(store.getState().segments.find((seg) => seg.id === 'a').hasAudio, false);
});

test('A1 吸附独立补齐和拖拽重排，视觉轨道不变，支持整次撤销', () => {
  const original = setup();
  store.setState({ segments: [...original.segments, { id: 'audio2', type: 'audio', start: 20, duration: 3 }], trackSettings: { V1: { excludeGaps: true }, A1: { excludeGaps: false, volume: 1, hidden: false } } });
  store.getState().setTrackSetting('A1', { excludeGaps: true });
  const before = { segments: store.getState().segments, selectedId: 'audio' };
  assert.deepEqual(before.segments.filter((s) => s.type === 'audio').map((s) => s.start), [0, 9]);
  for (const start of [15, 20, 20]) store.getState().previewAudioSegment('audio', start, before);
  assert.deepEqual(store.getState().segments.filter((s) => s.type === 'audio').map((s) => [s.id, s.start]), [['audio2', 0], ['audio', 3]]);
  assert.deepEqual(positions(), [['a', 0], ['b', 3], ['c', 6]]);
  store.getState().commitAudioSegment('audio', before);
  store.getState().undo();
  assert.deepEqual(store.getState().segments, before.segments);
  store.getState().setTrackSetting('A1', { hidden: true, volume: 0 });
  assert.equal(store.getState().trackSettings.A1.hidden, true);
  assert.equal(store.getState().trackSettings.A1.volume, 0);
  assert.equal(store.getState().trackSettings.V1.excludeGaps, true);
});

test('无首尾感应目标时，重叠拖动不推动后续片段，自由空隙可落位', () => {
  const before = setup();
  store.getState().previewVisualSegment('b', 5, before, null);
  assert.deepEqual(positions(), [['a', 0], ['b', 3], ['c', 6]]);
  store.getState().previewVisualSegment('b', 12, before, null);
  assert.deepEqual(positions(), [['a', 0], ['c', 6], ['b', 12]]);
});

test('仅命中固定首尾插入目标时推动后续片段，离开后恢复', () => {
  const before = setup();
  store.getState().previewVisualSegment('c', 3, before, { time: 3, index: 1 });
  assert.deepEqual(positions(), [['a', 0], ['c', 3], ['b', 6]]);
  store.getState().previewVisualSegment('c', 4, before, null);
  assert.deepEqual(positions(), [['a', 0], ['b', 3], ['c', 6]]);
});

test('关闭吸附：末片段后移不推动前片段，保留间隙', () => {
  const before = setup();
  store.getState().previewVisualSegment('c', 12, before);
  assert.deepEqual(positions(), [['a', 0], ['b', 3], ['c', 12]]);
});

test('首片段移到末尾时同步写回数组顺序，其他轨道不变', () => {
  const before = setup();
  store.getState().previewVisualSegment('a', 10, before);
  assert.deepEqual(positions(), [['b', 3], ['c', 6], ['a', 10]]);
  for (const id of ['audio', 'subtitle']) {
    assert.equal(store.getState().segments.find((s) => s.id === id), before.segments.find((s) => s.id === id));
  }
});

test('连续预览和重复释放位置不累积后移，退回时撤掉临时推移', () => {
  const before = setup();
  for (const start of [4, 4.5, 5, 5]) store.getState().previewVisualSegment('b', start, before);
  assert.deepEqual(positions(), [['a', 0], ['b', 5], ['c', 8]]);
  store.getState().previewVisualSegment('b', 4, before);
  assert.deepEqual(positions(), [['a', 0], ['b', 4], ['c', 7]]);
});

test('开启吸附：重排后从零连续排列，前后往返稳定', () => {
  const before = setup(true);
  for (const start of [7, 10, 10]) store.getState().previewVisualSegment('a', start, before);
  assert.deepEqual(positions(), [['b', 0], ['c', 3], ['a', 6]]);
  store.getState().previewVisualSegment('a', 0, before);
  assert.deepEqual(positions(), [['a', 0], ['b', 3], ['c', 6]]);
});

test('拖回原位置不产生历史或脏状态', () => {
  const before = setup();
  store.getState().previewVisualSegment('b', 12, before);
  store.getState().previewVisualSegment('b', 3, before);
  store.getState().commitVisualSegment('b', before);
  assert.equal(store.getState().segments, before.segments);
  assert.equal(store.getState().past.length, 0);
  assert.equal(store.getState().dirty, false);
});

test('释放只记录一次历史，撤销和重做整体恢复排布', () => {
  const before = setup();
  for (const start of [4, 5, 10]) store.getState().previewVisualSegment('b', start, before);
  assert.equal(store.getState().past.length, 0);
  const result = store.getState().segments;
  store.getState().commitVisualSegment('b', before);
  assert.equal(store.getState().past.length, 1);
  store.getState().undo();
  assert.deepEqual(store.getState().segments, before.segments);
  store.getState().redo();
  assert.deepEqual(store.getState().segments, result);
});
