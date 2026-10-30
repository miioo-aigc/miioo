import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createTestViteServer } from './lib/create-test-vite-server.mjs';
const server = await createTestViteServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
after(() => server.close());
const { useCompositionEditorStore: store } = await server.ssrLoadModule('/src/stores/compositionEditorStore.js');
const { commonClipActions } = await server.ssrLoadModule('/src/components/compositionEditor/TimelineSelection.js');
function seed() {
  store.setState({ ...store.getInitialState(), loaded: true, trackSettings: { V1: {}, V2: {}, A1: {}, A2: {}, S1: {}, S2: {} },
    segments: [{ id: 'v', type: 'video', track: 'V1', start: 2, duration: 2 }, { id: 'a', type: 'audio', track: 'A2', start: 3, duration: 2 }, { id: 's', type: 'subtitle', track: 'S1', start: 4, duration: 1 }],
    mainTracks: { V: 'V1', A: null, S: null }, selectedIds: ['v', 'a', 's'], selectedId: null });
  return store.getState();
}
test('三类空轨上下新增遵循编号方向且支持撤销', () => {
  for (const prefix of ['V', 'A', 'S']) for (const side of ['above', 'below']) {
    seed();
    store.setState({ trackSettings: Object.fromEntries(Object.entries(store.getState().trackSettings).map(([t, settings]) => [t, { ...settings, keepEmptyUntilUsed: true }])) });
    const before = store.getState();
    store.getState().insertTrack(prefix + '1', side);
    const at = 1 + ((prefix === 'A') === (side === 'below') ? 1 : 0);
    assert.ok(store.getState().trackSettings[prefix + at]);
    assert.equal(Object.keys(store.getState().trackSettings).filter(t => t[0] === prefix).length, 3);
    store.getState().undo(); assert.deepEqual(store.getState().segments, before.segments);
  }
});
test('交换轨道整体搬迁素材设置及主轨，拒绝跨类型', () => {
  const before = seed();
  store.getState().swapTracks('V1', 'A1'); assert.equal(store.getState().segments, before.segments);
  store.getState().swapTracks('V1', 'V2');
  assert.equal(store.getState().segments[0].track, 'V2');
  assert.equal(store.getState().mainTracks.V, 'V2');
  store.getState().undo(); assert.deepEqual(store.getState().segments, before.segments);
});
test('混选三类整体移动保持时间差，音频与视觉轨道编号方向相反', () => {
  const before = seed();
  assert.equal(store.getState().previewSelectionDrag(['v', 'a', 's'], 1, -1, before), true);
  const byId = Object.fromEntries(store.getState().segments.map(s => [s.id, s]));
  assert.deepEqual(['v','a','s'].map(id => [byId[id].track, byId[id].start]), [['V2',3],['A1',4],['S2',5]]);
  store.getState().commitSelectionDrag(before);
  assert.equal(store.getState().past.length, 1);
  store.getState().undo(); assert.deepEqual(store.getState().segments, before.segments);
});
test('整体移动越界、锁定、冲突全部拒绝且回到基线', () => {
  for (const kind of ['time', 'track', 'lock', 'collision']) {
    seed();
    if (kind === 'lock') store.setState({ trackSettings: { ...store.getState().trackSettings, V2: { locked: true } } });
    if (kind === 'collision') store.setState({ segments: [...store.getState().segments, { id: 'other', type: 'video', track: 'V2', start: 3, duration: 4 }] });
    const before = store.getState();
    assert.equal(store.getState().previewSelectionDrag(['v','a','s'], kind === 'time' ? -9 : 1, kind === 'track' ? -3 : -1, before), false);
    assert.equal(store.getState().segments, before.segments);
  }
});
test('字幕右键只提供删除，批量删除一次撤销', () => {
  const before = seed(); store.getState().selectMany(['s']);
  assert.deepEqual(commonClipActions(store.getState(), []), ['delete']);
  store.getState().applySelectionAction('delete');
  assert.equal(store.getState().segments.some(s => s.id === 's'), false);
  store.getState().undo(); assert.deepEqual(store.getState().segments, before.segments);
});

test('手建空轨保留，首次使用后清空自动删除，撤销恢复素材及轨道', () => {
  seed();
  store.setState({ trackSettings: { ...store.getState().trackSettings, V2: { keepEmptyUntilUsed: true } } });
  store.getState().insertTrack('V2', 'above');
  assert.equal(store.getState().trackSettings.V3.keepEmptyUntilUsed, true);
  store.getState().setMainTrack('V3');
  store.getState().addAsset({ id: 'asset', type: 'video', duration: 3 });
  const clip = store.getState().segments.find(s => s.assetId === 'asset');
  assert.equal(store.getState().trackSettings.V3.keepEmptyUntilUsed, undefined);
  store.getState().removeSegment(clip.id);
  assert.equal(store.getState().trackSettings.V3, undefined);
  store.getState().undo();
  assert.ok(store.getState().trackSettings.V3);
  assert.ok(store.getState().segments.some(s => s.id === clip.id));
});

const { trackSwapBoundary } = await server.ssrLoadModule('/src/utils/TimelineTrackEditing.js');
test('向上只接受上边界，向下只接受下边界，行中拒绝', () => {
  const source = { top: 100, bottom: 180 };
  assert.equal(trackSwapBoundary(source, { top: 20, bottom: 100 }, 22), 20);
  assert.equal(trackSwapBoundary(source, { top: 20, bottom: 100 }, 60), null);
  assert.equal(trackSwapBoundary(source, { top: 20, bottom: 100 }, 98), null);
  assert.equal(trackSwapBoundary(source, { top: 180, bottom: 260 }, 258), 260);
  assert.equal(trackSwapBoundary(source, { top: 180, bottom: 260 }, 182), null);
});
test('三类删除后连续编号，设置与主轨跟随，支持撤销重做', () => {
  for (const [prefix, type] of [['V', 'video'], ['A', 'audio'], ['S', 'subtitle']]) {
    const segments = [1,2,3,4,5].map(n => ({ id: String(n), type, track: prefix + n, start: 0, duration: 2 }));
    store.setState({ ...store.getInitialState(), loaded: true, segments, trackSettings: Object.fromEntries([1,2,3,4,5].map(n => [prefix+n, { volume: n / 5 }])), mainTracks: { [prefix]: prefix+'5' } });
    store.getState().deleteTrack(prefix+'4');
    store.getState().deleteTrack(prefix+'3');
    const result = store.getState();
    assert.deepEqual(result.segments.map(s => s.track), [prefix+'1',prefix+'2',prefix+'3']);
    assert.equal(result.mainTracks[prefix], prefix+'3');
    assert.equal(result.trackSettings[prefix+'3'].volume, 1);
    store.getState().undo();
    assert.equal(store.getState().segments.find(s => s.id === '5').track, prefix+'4');
    store.getState().redo();
    assert.deepEqual(store.getState().segments, result.segments);
  }
});

test('多选边界新增三类轨道，保留时间差并一次撤销', () => {
  for (const [prefix, type] of [['V','video'],['A','audio'],['S','subtitle']]) for (const side of ['above','below']) {
    const segments = [{id:'a',type,track:prefix+'1',start:1,duration:2},{id:'b',type,track:prefix+'1',start:5,duration:2}];
    store.setState({...store.getInitialState(),loaded:true,segments,selectedIds:['a','b']});
    const before=store.getState();
    const plan=before.planSelectionInsertion(['a','b'],'a',2,before,{anchor:prefix+'1',side});
    assert.ok(plan);
    assert.deepEqual(plan.segments.map(s=>s.start),[3,7]);
    assert.equal(plan.segments[0].track,plan.segments[1].track);
    store.getState().commitSelectionDrag(before,plan);
    assert.equal(store.getState().past.length,1);
    store.getState().undo(); assert.deepEqual(store.getState().segments,segments);
    store.getState().redo(); assert.deepEqual(store.getState().segments.map(s=>s.start),[3,7]);
  }
});
test('混选补齐上下边界且超六轨整组拒绝', () => {
  const before=seed();
  const plan=before.planSelectionInsertion(['v','a','s'],'v',1,before,{anchor:'V2',side:'above'});
  assert.ok(plan);
  const byId=Object.fromEntries(plan.segments.map(s=>[s.id,s]));
  assert.equal(byId.v.track,'V3'); assert.equal(byId.s.track,'S3'); assert.equal(byId.a.track,'A1');
  assert.equal(byId.a.start-byId.v.start,1);
  store.setState({trackSettings:{...before.trackSettings,V6:{keepEmptyUntilUsed:true}}});
  const full=store.getState();
  assert.equal(full.planSelectionInsertion(['v','a','s'],'v',1,full,{anchor:'V6',side:'above'}),null);
});

test('多选新增遇锁定、负时间或碰撞整组拒绝，预计算不改状态', () => {
  let before = seed();
  const original = before.segments;
  assert.equal(before.planSelectionInsertion(['v','a'],'v',-10,before,{anchor:'V1',side:'above'}),null);
  assert.equal(store.getState().segments,original);
  store.setState({trackSettings:{...before.trackSettings,A2:{locked:true}}});
  before=store.getState();
  assert.equal(before.planSelectionInsertion(['v','a'],'v',0,before,{anchor:'V1',side:'above'}),null);
  seed();
  store.setState({segments:[...store.getState().segments,{id:'collision',type:'audio',track:'A1',start:3,duration:2}]});
  before=store.getState();
  assert.equal(before.planSelectionInsertion(['v','a'],'v',0,before,{anchor:'V1',side:'above'}),null);
});
