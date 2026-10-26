import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
after(() => server.close());
const { useCompositionEditorStore: store, computeVisualWindows } = await server.ssrLoadModule('/src/stores/compositionEditorStore.js');
const { timelineShortcut, blocksTimelineShortcut } = await server.ssrLoadModule('/src/components/compositionEditor/UseTimelineShortcuts.js');

test('删除入口按受影响轨道吸附补齐，关闭吸附保留隐式位置，撤销整体恢复', () => {
  for (const action of ['deleteSelected', 'removeSegment', 'removeAsset']) {
    const segments = [
      { id: 'first', type: 'image', track: 'V1', start: 0, duration: 2 },
      { id: 'middle', assetId: 'deleted', type: 'video', track: 'V1', start: 2, duration: 6 },
      { id: 'later', type: 'video', track: 'V1', start: 8, duration: 2 },
      { id: 'audio-first', type: 'audio', track: 'A1', duration: 2 },
      { id: 'audio-middle', assetId: 'deleted', type: 'audio', track: 'A1', duration: 6 },
      { id: 'audio-last', type: 'audio', track: 'A1', duration: 2 },
      { id: 'sub-first', type: 'subtitle', track: 'S1', start: 0, duration: 2 },
      { id: 'sub-middle', assetId: 'deleted', type: 'subtitle', track: 'S1', start: 2, duration: 6 },
      { id: 'sub-last', type: 'subtitle', track: 'S1', start: 8, duration: 2 },
      { id: 'other', type: 'video', track: 'V2', start: 10, duration: 2 },
    ];
    store.setState({ ...store.getInitialState(), loaded: true, segments, selectedId: 'middle',
      selectedIds: action === 'deleteSelected' ? ['middle', 'audio-middle', 'sub-middle'] : [],
      album: [{ id: 'deleted' }], libraryAssetIds: ['deleted'],
      trackSettings: { V1: { excludeGaps: true }, A1: { excludeGaps: false }, S1: { excludeGaps: true }, V2: { excludeGaps: true } } });
    store.getState()[action](action === 'removeAsset' ? 'deleted' : 'middle');
    const state = store.getState();
    assert.equal(state.segments.find(({ id }) => id === 'later').start, 2);
    assert.equal(state.segments.find(({ id }) => id === 'other'), segments.at(-1));
    if (action !== 'removeSegment') {
      assert.equal(state.segments.find(({ id }) => id === 'audio-last').start, 8);
      assert.equal(state.segments.find(({ id }) => id === 'sub-last').start, 2);
    }
    assert.equal(state.past.length, 1);
    store.getState().undo();
    assert.equal(store.getState().segments, segments);
    assert.deepEqual(store.getState().libraryAssetIds, ['deleted']);
    store.getState().redo();
    assert.deepEqual(store.getState().segments, state.segments);
  }
  store.getState().removeSegment('missing');
  assert.equal(store.getState().past.length, 1);
});

test('各类轨道删除首中尾片段遵循各自吸附状态，允许删空', () => {
  for (const [type, track] of [['video', 'V1'], ['audio', 'A1'], ['subtitle', 'S1']]) {
    for (const excludeGaps of [true, false]) {
      for (const deleted of [0, 1, 2]) {
        const segments = [0, 1, 2].map((index) => ({ id: String(index), type, track, start: index * 2.25, duration: 2.25 }));
        store.setState({ ...store.getInitialState(), loaded: true, segments, trackSettings: { [track]: { excludeGaps } } });
        store.getState().removeSegment(String(deleted));
        const remaining = store.getState().segments;
        assert.deepEqual(remaining.map(({ start }) => start), excludeGaps ? [0, 2.25] : segments.filter((_, index) => index !== deleted).map(({ start }) => start));
        remaining.forEach(({ id }) => store.getState().removeSegment(id));
        assert.deepEqual(store.getState().segments, []);
      }
    }
  }
});

test('倍速缩短或延长按当前轨道吸附重排，其他轨道不变且撤销整体恢复', () => {
  for (const [type, track] of [['video', 'V2'], ['audio', 'A2']]) {
    for (const excludeGaps of [true, false]) {
      for (const speed of [2, 0.5]) {
        const segments = [
          { id: 'first', type, track, start: 0, duration: 2 },
          { id: 'target', type, track, start: 2, duration: 6, sourceDuration: 6, speed: 1 },
          { id: 'next', type, track, start: 8, duration: 2 },
          { id: 'last', type, track, start: 10, duration: 2 },
          { id: 'other', type: 'video', track: 'V1', start: 8, duration: 2 },
          { id: 'subtitle', type: 'subtitle', track: 'S1', start: 8, duration: 2 },
        ];
        store.setState({ ...store.getInitialState(), loaded: true, segments, selectedId: 'target',
          trackSettings: { [track]: { excludeGaps } } });
        store.getState().setSpeed('target', speed);
        const result = store.getState().segments;
        assert.equal(result[1].duration, 6 / speed);
        assert.equal(result[2].start, excludeGaps ? 2 + 6 / speed : 8);
        assert.equal(result[3].start, excludeGaps ? 4 + 6 / speed : 10);
        assert.equal(result[4], segments[4]);
        assert.equal(result[5], segments[5]);
        assert.equal(store.getState().past.length, 1);
        store.getState().setSpeed('target', speed);
        assert.equal(store.getState().past.length, 1);
        store.getState().undo();
        assert.equal(store.getState().segments, segments);
        store.getState().redo();
        assert.deepEqual(store.getState().segments, result);
      }
    }
  }
});

test('主动定位与末尾重播增加 seekEpoch，逐帧推进和暂停不增加', () => {
  store.setState({ ...store.getInitialState(), segments: [{ id: 'one', type: 'image', duration: 3 }] });
  store.getState().seek(1.2);
  assert.equal(store.getState().seekEpoch, 1);
  store.getState().onCursorTick(2);
  store.getState().pause();
  assert.equal(store.getState().seekEpoch, 1);
  store.getState().seek(3);
  store.getState().play();
  assert.equal(store.getState().cursor, 0);
  assert.equal(store.getState().seekEpoch, 3);
});

test('输入、弹窗和已消费事件不抢占快捷键', () => {
  const clear = { querySelector: () => null };
  assert.equal(blocksTimelineShortcut({}, clear), false);
  assert.equal(blocksTimelineShortcut({ defaultPrevented: true }, clear), true);
  assert.equal(blocksTimelineShortcut({ target: { closest: () => ({}) } }, clear), true);
  assert.equal(blocksTimelineShortcut({}, { querySelector: () => ({}) }), true);
});

test('第一阶段快捷键映射支持双平台并排除冲突修饰键', () => {
  for (const modifier of ['ctrlKey', 'metaKey']) {
    for (const [key, action] of Object.entries({ a: 'selectAll', s: 'save', b: 'splitSelected', z: 'undo', y: 'redo' })) {
      assert.equal(timelineShortcut({ key, [modifier]: true }), action);
    }
    assert.equal(timelineShortcut({ key: 'Z', [modifier]: true, shiftKey: true }), 'redo');
  }
  for (const [key, action] of Object.entries({ ' ': 'togglePlay', C: 'splitSelected', q: 'trimLeft', w: 'trimRight', Delete: 'deleteSelected', Backspace: 'deleteSelected', Escape: 'clearSelection', '+': 'zoomIn', '=': 'zoomIn', '-': 'zoomOut', ArrowUp: 'previous', ArrowDown: 'next' })) {
    assert.equal(timelineShortcut({ key }), action);
  }
  assert.equal(timelineShortcut({ key: '+', shiftKey: true }), 'zoomIn');
  for (const event of [{ key: 'c', altKey: true }, { key: 'c', isComposing: true }, { key: 'c', shiftKey: true }, { key: 'a', ctrlKey: true, shiftKey: true }]) {
    assert.equal(timelineShortcut(event), null);
  }
});

test('跨轨全选与批量删除只记录一次历史，撤销恢复选中且不删除资产', () => {
  const { segments } = setup();
  store.setState({ selectedIds: [], album: [{ id: 'asset' }], libraryAssetIds: ['asset'] });
  store.getState().selectAll();
  assert.deepEqual(store.getState().selectedIds, segments.map(({ id }) => id));
  assert.equal(store.getState().selectedId, null);
  assert.equal(store.getState().past.length, 0);
  store.getState().splitSelected();
  store.getState().trimSelected('left');
  assert.equal(store.getState().segments, segments);
  store.getState().deleteSelected();
  assert.equal(store.getState().segments.length, 0);
  assert.equal(store.getState().past.length, 1);
  assert.equal(store.getState().dirtyRev, 1);
  assert.deepEqual(store.getState().album, [{ id: 'asset' }]);
  assert.deepEqual(store.getState().libraryAssetIds, ['asset']);
  store.getState().undo();
  assert.equal(store.getState().segments, segments);
  assert.deepEqual(store.getState().selectedIds, segments.map(({ id }) => id));
  store.getState().redo();
  assert.equal(store.getState().segments.length, 0);
  store.getState().deleteSelected();
  assert.equal(store.getState().past.length, 1);
});

test('单选和取消选择清空全选状态，空时间线全选无历史', () => {
  setup();
  store.getState().selectAll();
  store.getState().select('a');
  assert.deepEqual(store.getState().selectedIds, []);
  assert.equal(store.getState().selectedId, 'a');
  store.getState().selectAll();
  store.getState().select(null);
  store.getState().deleteSelected();
  assert.equal(store.getState().past.length, 0);
  store.setState({ segments: [] });
  store.getState().selectAll();
  assert.deepEqual(store.getState().selectedIds, []);
  assert.equal(store.getState().past.length, 0);
});

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

test('删除整轨保留素材与其他轨道，一次撤销恢复片段、设置和主轨', () => {
  setup();
  store.setState({ album: [{ id: 'asset' }], libraryAssetIds: ['asset'], selectedId: 'audio', playing: true,
    trackSettings: { V1: { excludeGaps: true }, A1: { volume: 0.5 } } });
  const before = store.getState();
  store.getState().deleteTrack('A1');
  const next = store.getState();
  assert.deepEqual(next.segments, before.segments.filter((segment) => segment.type !== 'audio'));
  assert.equal(next.selectedId, null);
  assert.equal(next.mainTracks.A, null);
  assert.equal(next.trackSettings.A1, undefined);
  assert.equal(next.album, before.album);
  assert.equal(next.libraryAssetIds, before.libraryAssetIds);
  assert.equal(next.playing, false);
  assert.equal(next.dirtyRev, 1);
  assert.equal(next.past.length, 1);
  store.getState().undo();
  for (const key of ['segments', 'trackSettings', 'mainTracks', 'selectedId']) assert.deepEqual(store.getState()[key], before[key]);
  store.getState().redo();
  assert.deepEqual(store.getState().segments, next.segments);
});

test('最后一条轨道、最后一条画面轨及不存在的轨道删除不产生历史', () => {
  setup();
  const before = store.getState();
  for (const track of ['V1', 'V6', 'invalid']) store.getState().deleteTrack(track);
  assert.equal(store.getState().segments, before.segments);
  assert.equal(store.getState().past.length, 0);
  store.setState({ segments: [{ id: 's', type: 'subtitle', track: 'S1' }], trackSettings: {} });
  store.getState().deleteTrack('S1');
  assert.equal(store.getState().segments.length, 1);
  assert.equal(store.getState().past.length, 0);
});

test('空轨直接删除，视频轨删除不重排其他轨道，非目标选中保持', () => {
  setup();
  store.setState({ trackSettings: { V1: {}, V2: {}, S2: {} } });
  store.getState().deleteTrack('S2');
  assert.equal(store.getState().trackSettings.S2, undefined);
  assert.equal(store.getState().past.length, 1);
  store.getState().undo();
  assert.deepEqual(store.getState().trackSettings.S2, {});
  const other = { id: 'v2', type: 'image', track: 'V2', start: 12, duration: 2 };
  store.setState({ segments: [...store.getState().segments, other], selectedId: 'v2', past: [], future: [] });
  store.getState().deleteTrack('V1');
  assert.equal(store.getState().selectedId, 'v2');
  assert.equal(store.getState().segments.find((segment) => segment.id === 'v2'), other);
  assert.equal(store.getState().past.length, 1);
});

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

test('音量回到默认不生成历史，限制范围并写入后端字段', () => {
  const before = setup();
  store.getState().previewAudioVolume('audio', -2);
  assert.equal(store.getState().segments.find((s) => s.id === 'audio').volume, 0);
  store.getState().previewAudioVolume('audio', 3);
  assert.equal(store.getState().segments.find((s) => s.id === 'audio').volume, 2);
  store.getState().previewAudioVolume('audio', 1);
  store.getState().commitAudioVolume(before);
  assert.equal(store.getState().past.length, 0);
  assert.equal(store.getState().buildTimeline().find((s) => s.type === 'audio').volume, 1);
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
