import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createTestViteServer } from './lib/create-test-vite-server.mjs';
import { commonClipActions, intersectsSelection } from '../src/components/compositionEditor/TimelineSelection.js';
const server = await createTestViteServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
after(() => server.close());
const { useCompositionEditorStore: store, computeVisualWindows, computeAudioWindows } = await server.ssrLoadModule('/src/stores/compositionEditorStore.js');
const seed = () => store.setState({ mainTracks: { V: null, A: null, S: null }, trackSettings: { A1: { excludeGaps: false } }, loaded: true, dirty: false, dirtyRev: 0, past: [], future: [], selectedId: null, selectedIds: [], cursor: 2,
  segments: [{ id: 'v', assetId: 'v', type: 'video', track: 'V1', start: 0, duration: 6, offset: 1, speed: 2, sourceUrl: 'v.mp4' }, { id: 'a', assetId: 'a', type: 'audio', track: 'A1', start: 0, duration: 6, offset: 3, speed: 1 }],
});
const windows = () => [...computeVisualWindows(store.getState().segments).windows, ...computeAudioWindows(store.getState().segments).windows];
for (const snap of [false, true]) {
  test(`批量分离按轨道上下及轨内左右排序，不受选择顺序影响，磁吸${snap}`, () => {
    seed();
    const video = store.getState().segments[0];
    const videos = [
      { ...video, id: 'lower', assetId: 'lower', track: 'V2', start: 0, duration: 2 },
      { ...video, id: 'left', assetId: 'left', track: 'V1', start: 10, duration: 3 },
      { ...video, id: 'right', assetId: 'right', track: 'V1', start: 20, duration: 4 },
    ];
    const existing = { id: 'existing', type: 'audio', track: 'A2', start: 0, duration: 5 };
    store.setState({ segments: [...videos, existing], mainTracks: { A: 'A2' },
      trackSettings: { A2: { excludeGaps: snap } } });
    const before = store.getState().segments;
    store.getState().selectMany(['right', 'lower', 'left']);
    store.getState().applySelectionAction('detach');
    const after = store.getState().segments;
    const audio = computeAudioWindows(after, 'A2').windows.filter((w) => w.seg.id !== 'existing');
    assert.deepEqual(audio.map((w) => w.seg.assetId), ['left', 'right', 'lower']);
    assert.deepEqual(audio.map((w) => w.start), snap ? [5, 8, 12] : [10, 20, 24]);
    assert.deepEqual(audio.map((w) => [w.seg.duration, w.seg.offset, w.seg.speed]), [[3, 1, 2], [4, 1, 2], [2, 1, 2]]);
    assert.deepEqual(after.find((s) => s.id === 'existing'), existing);
    assert.ok(after.filter((s) => s.type === 'video').every((s) => s.hasAudio === false));
    assert.equal(store.getState().past.length, 1);
    store.getState().undo();
    assert.deepEqual(store.getState().segments, before);
    store.getState().redo();
    assert.deepEqual(store.getState().segments, after);
  });
}
test('相交即可框选，完全不相交或仅贴边不选中', () => {
  const box = { left: 10, top: 10, right: 20, bottom: 20 };
  assert.equal(intersectsSelection(box, { left: 19, top: 19, right: 30, bottom: 30 }), true);
  assert.equal(intersectsSelection(box, { left: 20, top: 20, right: 30, bottom: 30 }), false);
});
test('多选去重并过滤失效素材，不标记工程修改', () => {
  seed(); store.getState().selectMany(['v', 'a', 'v', 'gone']);
  assert.deepEqual(store.getState().selectedIds, ['v', 'a']);
  assert.equal(store.getState().selectedId, null);
  assert.equal(store.getState().dirty, false);
});
test('混选菜单仅共同操作；游标不穿过所有素材时不提供裁剪切割', () => {
  seed(); store.getState().selectMany(['v', 'a']);
  assert.deepEqual(commonClipActions(store.getState(), windows()), ['split', 'trimLeft', 'trimRight', 'speed', 'delete']);
  store.setState({ cursor: 8 });
  assert.deepEqual(commonClipActions(store.getState(), windows()), ['speed', 'delete']);
});
test('不满足共同条件时批量分离不会部分执行', () => {
  seed(); store.getState().selectMany(['v', 'a']);
  const before = store.getState().segments;
  store.getState().applySelectionAction('detach');
  assert.equal(store.getState().segments, before);
});
test('批量切割换算偏移并保留右段起点，一次撤销恢复全部选择', () => {
  seed(); store.getState().selectMany(['v', 'a']);
  store.getState().applySelectionAction('split');
  assert.equal(store.getState().segments.length, 4);
  const right = store.getState().segments.filter((s) => s.start === 2);
  assert.equal(right.length, 2);
  assert.deepEqual(right.map((s) => s.offset), [5, 5]);
  assert.equal(store.getState().past.length, 1);
  store.getState().undo();
  assert.equal(store.getState().segments.length, 2);
  assert.deepEqual(store.getState().selectedIds, ['v', 'a']);
  store.getState().redo(); assert.equal(store.getState().segments.length, 4);
});
test('批量删除可一次撤销', () => {
  seed(); store.getState().selectMany(['v', 'a']); store.getState().applySelectionAction('delete');
  assert.equal(store.getState().segments.length, 0);
  store.getState().undo(); assert.equal(store.getState().segments.length, 2);
});
test('同类视频批量分离全部执行，一次撤销恢复', () => {
  seed(); const v = store.getState().segments[0];
  store.setState({ segments: [v, { ...v, id: 'v2', assetId: 'v2', start: 6 }] });
  store.getState().selectMany(['v', 'v2']); store.getState().applySelectionAction('detach');
  assert.equal(store.getState().segments.filter((s) => s.type === 'audio').length, 2);
  assert.equal(store.getState().past.length, 1);
  store.getState().undo(); assert.equal(store.getState().segments.length, 2);
});
test('批量左裁剪使用同一个游标并正确换算倍速偏移', () => {
  seed(); store.getState().selectMany(['v', 'a']); store.getState().applySelectionAction('trimLeft');
  assert.deepEqual(store.getState().segments.map((s) => s.duration), [4, 4]);
  assert.deepEqual(store.getState().segments.map((s) => s.offset), [5, 5]);
  assert.equal(store.getState().cursor, 2);
  assert.equal(store.getState().past.length, 1);
});
test('批量倍速保持各自源窗口，一次撤销恢复', () => {
  seed(); store.getState().selectMany(['v', 'a']); store.getState().applySelectionAction('speed', 2);
  assert.deepEqual(store.getState().segments.map((s) => s.speed), [2, 2]);
  assert.equal(store.getState().segments.find((s) => s.id === 'a').duration, 3);
  assert.equal(store.getState().past.length, 1);
  store.getState().undo(); assert.equal(store.getState().segments.find((s) => s.id === 'a').duration, 6);
});
test('分离后移动、删除独立音频仍禁止单选重复分离', () => {
  seed();
  store.getState().selectMany(['v']);
  store.getState().detachAudio('v');
  const audio = store.getState().segments.find((s) => s.type === 'audio' && s.assetId === 'v');
  store.getState().updateSegment(audio.id, { start: 20, track: 'A2' });
  assert.equal(store.getState().hasDetachedAudio('v'), true);
  assert.equal(commonClipActions(store.getState(), windows()).includes('detach'), false);
  const moved = store.getState().segments;
  store.getState().detachAudio('v');
  assert.equal(store.getState().segments, moved);
  store.getState().removeSegment(audio.id);
  assert.equal(store.getState().hasDetachedAudio('v'), true);
  assert.equal(commonClipActions(store.getState(), windows()).includes('detach'), false);
  const removed = store.getState().segments;
  store.getState().detachAudio('v');
  assert.equal(store.getState().segments, removed);
});
test('批量分离后删除音频仍禁用，撤销至分离前才恢复且重做再次禁用', () => {
  seed();
  const v = store.getState().segments[0];
  store.setState({ segments: [v, { ...v, id: 'v2', assetId: 'v2', start: 6 }] });
  store.getState().selectMany(['v', 'v2']);
  store.getState().applySelectionAction('detach');
  const audioIds = store.getState().segments.filter((s) => s.type === 'audio').map((s) => s.id);
  store.getState().selectMany(audioIds);
  store.getState().applySelectionAction('delete');
  store.getState().selectMany(['v', 'v2']);
  assert.equal(commonClipActions(store.getState(), windows()).includes('detach'), false);
  const before = store.getState().segments;
  const pastLength = store.getState().past.length;
  store.getState().applySelectionAction('detach');
  assert.equal(store.getState().segments, before);
  assert.equal(store.getState().past.length, pastLength);
  store.getState().undo(); // 撤销删除
  assert.ok(['v', 'v2'].every((id) => store.getState().hasDetachedAudio(id)));
  store.getState().undo(); // 撤销分离
  assert.ok(['v', 'v2'].every((id) => !store.getState().hasDetachedAudio(id)));
  store.getState().selectMany(['v', 'v2']);
  assert.equal(commonClipActions(store.getState(), windows()).includes('detach'), true);
  store.getState().redo();
  assert.ok(['v', 'v2'].every((id) => store.getState().hasDetachedAudio(id)));
});
test('同源视频片段独立判断分离状态，不误禁用另一片段', () => {
  seed();
  const v = store.getState().segments[0];
  store.setState({ segments: [v, { ...v, id: 'v2', track: 'V2' }] });
  store.getState().detachAudio('v');
  assert.equal(store.getState().hasDetachedAudio('v2'), false);
  store.getState().detachAudio('v2');
  assert.equal(store.getState().segments.filter((s) => s.type === 'audio').length, 2);
});

for (const main of [null, 'A2']) {
  for (const snap of [false, true]) {
    test('分离落点遵循' + (main || '默认A1') + '及磁吸' + snap + '，不移动已有素材', () => {
      seed();
      const target = main || 'A1';
      const video = { ...store.getState().segments[0], start: 2, duration: 3 };
      const existing = [
        { id: 'late', type: 'audio', track: target, start: 8, duration: 4 },
        { id: 'early', type: 'audio', track: target, start: 0, duration: 4 },
        { id: 'other', type: 'audio', track: main ? 'A1' : 'A2', start: 0, duration: 100 },
      ];
      store.setState({ segments: [video, ...existing], mainTracks: { A: main },
        trackSettings: { [target]: { excludeGaps: snap }, [main ? 'A1' : 'A2']: { excludeGaps: !snap } } });
      store.getState().detachAudio('v');
      const added = store.getState().segments.find((s) => s.assetId === 'v' && s.type === 'audio');
      assert.equal(added.track, target);
      assert.equal(added.start, snap ? 12 : 4);
      assert.equal(added.offset, video.offset);
      assert.equal(added.speed, video.speed);
      assert.deepEqual(store.getState().segments.filter((s) => existing.includes(s)), existing);
      store.getState().undo();
      assert.deepEqual(store.getState().segments, [video, ...existing]);
      store.getState().redo();
      assert.equal(store.getState().segments.find((s) => s.id === added.id).start, snap ? 12 : 4);
    });
    test('空轨分离' + (main || 'A1') + '磁吸' + snap, () => {
      seed();
      const track = main || 'A1';
      store.setState({ segments: [{ ...store.getState().segments[0], start: 10 }],
        mainTracks: { A: main }, trackSettings: { [track]: { excludeGaps: snap } } });
      store.getState().detachAudio('v');
      assert.equal(store.getState().segments.find((s) => s.type === 'audio').start, snap ? 0 : 10);
    });
  }
}
test('关闭磁吸时跳过不足容纳的空隙，边界贴合不算重叠', () => {
  seed();
  const video = { ...store.getState().segments[0], start: 2, duration: 3 };
  store.setState({ segments: [video,
    { id: 'one', type: 'audio', start: 0, duration: 4 },
    { id: 'two', type: 'audio', start: 6, duration: 3 },
    { id: 'three', type: 'audio', start: 12, duration: 2 },
  ] });
  store.getState().detachAudio('v');
  assert.equal(store.getState().segments.find((s) => s.type === 'audio' && s.assetId === 'v').start, 9);
});
for (const snap of [false, true]) {
  test('批量分离逐个避让新增音频且一次撤销，磁吸' + snap, () => {
    seed();
    const video = { ...store.getState().segments[0], start: 0, duration: 3 };
    store.setState({ segments: [video, { ...video, id: 'v2', track: 'V2' },
      { id: 'existing', type: 'audio', track: 'A2', start: 0, duration: 5 }],
      mainTracks: { A: 'A2' }, trackSettings: { A2: { excludeGaps: snap } } });
    const before = store.getState().segments;
    store.getState().selectMany(['v', 'v2']);
    store.getState().applySelectionAction('detach');
    assert.deepEqual(computeAudioWindows(store.getState().segments, 'A2').windows.map((w) => w.start), [0, 5, 8]);
    assert.equal(store.getState().past.length, 1);
    store.getState().undo();
    assert.deepEqual(store.getState().segments, before);
  });
}

test('跨轨批量裁剪分别遵循吸附设置且一次撤销', () => {
  for (const action of ['trimLeft', 'trimRight']) {
    seed();
    store.setState({ trackSettings: { V1: { excludeGaps: true }, A1: { excludeGaps: false } } });
    const before = store.getState().segments;
    store.getState().selectMany(['v', 'a']);
    store.getState().applySelectionAction(action);
    const [video, audio] = store.getState().segments;
    assert.equal(video.start, 0);
    assert.equal(audio.start, action === 'trimLeft' ? 2 : 0);
    assert.equal(video.duration, action === 'trimLeft' ? 4 : 2);
    assert.equal(audio.duration, video.duration);
    assert.equal(store.getState().past.length, 1);
    store.getState().undo();
    assert.deepEqual(store.getState().segments, before);
  }
});
