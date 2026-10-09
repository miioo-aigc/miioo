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
  store.setState({ mainTracks: { V: 'V1', A: 'A1', S: 'S1' } });
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

test('再次点击主轨取消，仅影响同类型，支持撤销重做和默认落轨', () => {
  for (const [prefix, type] of [['V', 'video'], ['A', 'audio'], ['S', 'subtitle']]) {
    setup();
    store.getState().setMainTrack(`${prefix}2`);
    const before = store.getState();
    store.getState().setMainTrack(`${prefix}2`);
    assert.deepEqual(store.getState().mainTracks, { ...before.mainTracks, [prefix]: null });
    assert.equal(store.getState().segments, before.segments);
    assert.deepEqual(store.getState().trackSettings, before.trackSettings);
    assert.equal(store.getState().past.length, before.past.length + 1);
    store.getState().undo();
    assert.equal(store.getState().mainTracks[prefix], `${prefix}2`);
    store.getState().redo();
    assert.equal(store.getState().mainTracks[prefix], null);
    store.getState().addAsset({ id: `new-${prefix}`, type, duration: 3 });
    assert.equal(store.getState().segments.at(-1).track, `${prefix}1`);
  }
});

test('默认无主轨，添加素材回退第一轨且不自动设置主轨，撤销恢复未设置', () => {
  setup();
  const empty = { V: null, A: null, S: null };
  assert.deepEqual(store.getInitialState().mainTracks, empty);
  store.setState({ segments: [], mainTracks: empty });
  for (const type of ['video', 'audio', 'subtitle']) store.getState().addAsset({ id: type, type, duration: 3 });
  assert.deepEqual(store.getState().segments.map((seg) => seg.track), ['V1', 'A1', 'S1']);
  assert.deepEqual(store.getState().mainTracks, empty);
  store.getState().setMainTrack('V1');
  assert.equal(store.getState().mainTracks.V, 'V1');
  store.getState().undo();
  assert.deepEqual(store.getState().mainTracks, empty);
  const { segments, trackSettings, mainTracks } = store.getState();
  const before = { segments, trackSettings, mainTracks };
  store.getState().previewTrackSegment(segments[0].id, 'V2', 0, before);
  store.getState().commitTrackDrag(segments[0].id, before, 2);
  assert.deepEqual(store.getState().mainTracks, empty);
});

test('中间插入轨道顺延编号、设置和主轨，一次撤销整体恢复', () => {
  setup();
  store.setState({ segments: [{ id: 'a', type: 'video', track: 'V1', duration: 3, start: 0 }, { id: 'b', type: 'video', track: 'V2', duration: 3, start: 5 }], trackSettings: { V2: { hidden: true, volume: 0, excludeGaps: false } }, mainTracks: { V: 'V2', A: 'A1', S: 'S1' } });
  const { segments, trackSettings, mainTracks } = store.getState();
  const before = { segments, trackSettings, mainTracks };
  store.getState().previewTrackSegment('a', 'V3', 2, before);
  store.getState().commitTrackDrag('a', before, 2);
  assert.equal(store.getState().segments.find((s) => s.id === 'a').track, 'V2');
  assert.equal(store.getState().segments.find((s) => s.id === 'b').track, 'V3');
  assert.equal(store.getState().segments.find((s) => s.id === 'b').start, 5);
  assert.equal(store.getState().mainTracks.V, 'V3');
  assert.equal(store.getState().trackSettings.V3.hidden, true);
  assert.equal(store.getState().past.length, 1);
  store.getState().undo();
  assert.deepEqual(store.getState().segments, segments);
  assert.deepEqual(store.getState().trackSettings, trackSettings);
  assert.deepEqual(store.getState().mainTracks, mainTracks);
});

test('字幕跨轨、每类六轨上限及主轨新增素材', () => {
  setup();
  store.setState({ segments: [{ id: 's', type: 'subtitle', track: 'S1', start: 1, duration: 3 }], trackSettings: {} });
  const before = { segments: store.getState().segments };
  store.getState().previewTrackSegment('s', 'S7', 2, before);
  assert.equal(store.getState().segments, before.segments);
  store.getState().previewTrackSegment('s', 'S2', 2, before);
  assert.equal(store.getState().segments[0].track, 'S2');
  store.getState().setMainTrack('S2');
  store.getState().addAsset({ id: 'text', type: 'subtitle', duration: 2 });
  assert.equal(store.getState().segments.at(-1).track, 'S2');
  for (const type of ['V', 'A', 'S']) {
    const main = store.getState().mainTracks[type];
    store.getState().setMainTrack(`${type}7`);
    assert.equal(store.getState().mainTracks[type], main);
  }
});

test('跨轨拖拽补齐源轨，保持其他轨道，释放一次历史并可撤销', () => {
  const before = setup(true);
  store.getState().previewTrackSegment('b', 'V2', 4, before);
  assert.equal(store.getState().segments.find((s) => s.id === 'b').track, 'V2');
  assert.equal(store.getState().segments.find((s) => s.id === 'b').start, 4);
  assert.equal(store.getState().segments.find((s) => s.id === 'c').start, 3);
  assert.equal(store.getState().segments.find((s) => s.id === 'audio'), before.segments[1]);
  assert.equal(store.getState().past.length, 0);
  store.getState().commitVisualSegment('b', before);
  assert.equal(store.getState().past.length, 1);
  store.getState().undo();
  assert.deepEqual(store.getState().segments, before.segments);
});

test('跨轨类型限制、自由定位冲突及音频新轨', () => {
  const before = setup();
  store.getState().previewTrackSegment('b', 'A2', 0, before);
  assert.equal(store.getState().segments, before.segments);
  store.getState().previewTrackSegment('b', 'V1', 1, before);
  assert.equal(store.getState().segments, before.segments);
  store.getState().previewTrackSegment('audio', 'A2', 5, before);
  assert.equal(store.getState().segments.find((s) => s.id === 'audio').track, 'A2');
});

test('目标轨吸附独立，预览不累积且回原点不记录历史', () => {
  const before = setup();
  store.setState({ trackSettings: { V2: { excludeGaps: true } } });
  store.getState().previewTrackSegment('b', 'V2', 12, before);
  assert.equal(store.getState().segments.find((s) => s.id === 'b').start, 0);
  store.getState().previewTrackSegment('b', 'V1', 3, before);
  store.getState().commitVisualSegment('b', before);
  assert.equal(store.getState().past.length, 0);
});

test('重复素材可添加并同步删除全部轨道实例，撤销恢复素材列表', () => {
  setup();
  const asset = { id: 'shared', type: 'video', duration: 3 };
  store.setState({ segments: [], album: [asset] });
  store.getState().addAsset(asset);
  store.getState().addAsset(asset);
  assert.equal(store.getState().segments.length, 2);
  assert.notEqual(store.getState().segments[0].id, store.getState().segments[1].id);
  store.getState().removeAsset('shared');
  assert.equal(store.getState().segments.length, 0);
  assert.equal(store.getState().album.length, 0);
  store.getState().undo();
  assert.equal(store.getState().segments.length, 2);
  assert.deepEqual(store.getState().album, [asset]);
});

test('多轨窗口与保存起点独立，保留空隙', () => {
  setup();
  store.setState({ segments: [
    { id: 'v1', type: 'video', track: 'V1', start: 2, duration: 3 },
    { id: 'v2', type: 'video', track: 'V2', start: 1, duration: 3 },
    { id: 'a2', type: 'audio', track: 'A2', start: 4, duration: 3 },
  ] });
  assert.deepEqual(positions(), [['v1', 2], ['v2', 1]]);
  assert.deepEqual(store.getState().buildTimeline().map((s) => [s.track, s.start]), [['V1', 2], ['V2', 1], ['A2', 4]]);
});

test('设为入点保留精确源位置并重置游标，避免旧时长反向钳制', () => {
  setup();
  const source = { id: 'clip', type: 'audio', start: 5, offset: 0, duration: 10, sourceDuration: 10 };
  store.setState({ segments: [source], cursor: 11, playing: true });
  store.getState().setSegmentInPoint('clip');
  assert.equal(store.getState().segments[0].offset, 6);
  assert.equal(store.getState().segments[0].duration, 4);
  assert.equal(store.getState().cursor, 5);
  assert.equal(store.getState().playing, false);
  assert.equal(store.getState().past.length, 1);
  store.getState().undo();
  assert.deepEqual(store.getState().segments, [source]);
});

test('视频入点计入既有 offset 与倍速，剩余素材充足则保留时长', () => {
  setup();
  store.setState({ segments: [{ id: 'clip', type: 'video', start: 0, offset: 2, speed: 2, duration: 5, sourceDuration: 30 }], cursor: 3 });
  store.getState().setSegmentInPoint('clip');
  assert.equal(store.getState().segments[0].offset, 8);
  assert.equal(store.getState().segments[0].duration, 5);
  assert.equal(store.getState().cursor, 0);
  store.getState().setSegmentInPoint('clip');
  assert.equal(store.getState().past.length, 1);
});

test('单片段音量实时预览，不暂停播放，整次提交一次历史且可撤销恢复', () => {
  const before = setup();
  store.setState({ playing: true });
  for (const volume of [0.8, 0.5, 0]) store.getState().previewAudioVolume('audio', volume);
  assert.equal(store.getState().playing, true);
  assert.equal(store.getState().past.length, 0);
  assert.equal(store.getState().segments.find((s) => s.id === 'audio').volume, 0);
  assert.equal(store.getState().segments.find((s) => s.id === 'a'), before.segments[0]);
  store.getState().commitAudioVolume(before);
  assert.equal(store.getState().past.length, 1);
  store.getState().undo();
  assert.equal(store.getState().segments.find((s) => s.id === 'audio').volume, undefined);
  store.getState().redo();
  assert.equal(store.getState().segments.find((s) => s.id === 'audio').volume, 0);
});

test('音量回到默认不生成历史，限制范围且不写入后端字段', () => {
  const before = setup();
  store.getState().previewAudioVolume('audio', -2);
  assert.equal(store.getState().segments.find((s) => s.id === 'audio').volume, 0);
  store.getState().previewAudioVolume('audio', 3);
  assert.equal(store.getState().segments.find((s) => s.id === 'audio').volume, 2);
  store.getState().previewAudioVolume('audio', 1);
  store.getState().commitAudioVolume(before);
  assert.equal(store.getState().past.length, 0);
  assert.equal(store.getState().buildTimeline().find((s) => s.type === 'audio').volume, undefined);
});

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
