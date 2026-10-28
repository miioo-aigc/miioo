import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createTestViteServer } from './lib/create-test-vite-server.mjs';
import { commonClipActions, intersectsSelection } from '../src/components/compositionEditor/TimelineSelection.js';
const server = await createTestViteServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
after(() => server.close());
const { useCompositionEditorStore: store, computeVisualWindows, computeAudioWindows } = await server.ssrLoadModule('/src/stores/compositionEditorStore.js');
const seed = () => store.setState({ loaded: true, dirty: false, dirtyRev: 0, past: [], future: [], selectedId: null, selectedIds: [], cursor: 2,
  segments: [{ id: 'v', assetId: 'v', type: 'video', track: 'V1', start: 0, duration: 6, offset: 1, speed: 2, sourceUrl: 'v.mp4' }, { id: 'a', assetId: 'a', type: 'audio', track: 'A1', start: 0, duration: 6, offset: 3, speed: 1 }],
});
const windows = () => [...computeVisualWindows(store.getState().segments).windows, ...computeAudioWindows(store.getState().segments).windows];
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
test('独立音频存在时禁止重复分离，删除后单选可再次分离且视频仍静音', () => {
  seed();
  store.getState().selectMany(['v']);
  store.getState().detachAudio('v');
  const firstAudio = store.getState().segments.find((s) => s.type === 'audio' && s.assetId === 'v');
  assert.equal(store.getState().hasDetachedAudio('v'), true);
  assert.equal(commonClipActions(store.getState(), windows()).includes('detach'), false);
  const before = store.getState().segments;
  store.getState().detachAudio('v');
  assert.equal(store.getState().segments, before);
  store.getState().removeSegment(firstAudio.id);
  assert.equal(store.getState().segments.find((s) => s.id === 'v').hasAudio, false);
  assert.equal(store.getState().hasDetachedAudio('v'), false);
  assert.equal(commonClipActions(store.getState(), windows()).includes('detach'), true);
  store.getState().detachAudio('v');
  const restored = store.getState().segments.filter((s) => s.type === 'audio' && s.assetId === 'v');
  assert.equal(restored.length, 1);
  assert.notEqual(restored[0].id, firstAudio.id);
  for (const key of ['assetId', 'duration', 'offset', 'speed', 'start', 'sourceUrl', 'track']) {
    assert.equal(restored[0][key], firstAudio[key]);
  }
  assert.equal(store.getState().segments.find((s) => s.id === 'v').hasAudio, false);
});
test('删除分离音频后批量菜单恢复可用，重新分离可一次撤销恢复', () => {
  seed();
  const v = store.getState().segments[0];
  store.setState({ segments: [v, { ...v, id: 'v2', assetId: 'v2', start: 6 }] });
  store.getState().selectMany(['v', 'v2']);
  store.getState().applySelectionAction('detach');
  const audioIds = store.getState().segments.filter((s) => s.type === 'audio').map((s) => s.id);
  store.getState().selectMany(audioIds);
  store.getState().applySelectionAction('delete');
  store.getState().selectMany(['v', 'v2']);
  assert.equal(commonClipActions(store.getState(), windows()).includes('detach'), true);
  const pastLength = store.getState().past.length;
  store.getState().applySelectionAction('detach');
  assert.equal(store.getState().segments.filter((s) => s.type === 'audio').length, 2);
  assert.equal(store.getState().past.length, pastLength + 1);
  store.getState().undo();
  assert.equal(store.getState().segments.length, 2);
  assert.ok(store.getState().segments.every((s) => s.hasAudio === false));
  assert.equal(commonClipActions(store.getState(), windows()).includes('detach'), true);
  store.getState().redo();
  assert.ok(['v', 'v2'].every((id) => store.getState().hasDetachedAudio(id)));
});
