import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { createServer } from 'vite';
const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
after(() => server.close());
const { parseSubtitleFile, readSubtitleFile, subtitleColorWithOpacity } = await server.ssrLoadModule('/src/utils/SubtitleImport.js');
const { useCompositionEditorStore: store, serializeTimeline } = await server.ssrLoadModule('/src/stores/compositionEditorStore.js');
const reset = () => store.setState({ segments: [], selectedId: null, loaded: true, projectId: null, cursor: 0, past: [], future: [], mainTracks: { S: null }, trackSettings: {} });

test('新建字幕追加主轨末尾，忽略游标，取消主轨后恢复游标定位', () => {
  reset();
  store.getState().importSubtitles([{ text: 'first', start: 2, duration: 2 }, { text: 'overlap', start: 2, duration: 4 }]);
  store.setState({ mainTracks: { S: 'S2' }, cursor: 100 });
  const count = store.getState().segments.length;
  store.getState().addSubtitle();
  assert.equal(store.getState().segments.at(-1).track, 'S2');
  assert.equal(store.getState().segments.at(-1).start, 6);
  store.getState().undo();
  assert.equal(store.getState().segments.length, count);
  store.setState({ mainTracks: { S: null }, cursor: 10 });
  store.getState().addSubtitle();
  assert.equal(store.getState().segments.at(-1).start, 10);
});

test('新字幕默认关闭描边背景，文字不透明度连续预览一次提交与撤销', () => {
  reset();
  store.getState().addSubtitle();
  const seg = store.getState().segments[0];
  assert.equal(seg.style.outline, 0);
  assert.equal(seg.style.backgroundOn, false);
  const before = { segments: store.getState().segments, selectedId: seg.id };
  const count = store.getState().past.length;
  for (const textOpacity of [80, 60, 40]) store.getState().previewSubtitle(seg.id, { style: { textOpacity } });
  store.getState().commitVisualSegment(seg.id, before);
  assert.equal(store.getState().past.length, count + 1);
  assert.equal(serializeTimeline(store.getState().segments)[0].style.textOpacity, 40);
  store.getState().undo();
  assert.equal(store.getState().segments[0].style.textOpacity, 100);
});

test('描边与背景独立不透明度、序列化和撤销', () => {
  assert.equal(subtitleColorWithOpacity('#123456', 0), '#12345600');
  assert.equal(subtitleColorWithOpacity('#123456', 50), '#12345680');
  assert.equal(subtitleColorWithOpacity('#123456', 100), '#123456ff');
  reset();
  store.getState().importSubtitles([{ text: '字幕', start: 0, duration: 3 }]);
  const seg = store.getState().segments[0];
  const before = { segments: store.getState().segments, selectedId: seg.id };
  store.getState().previewSubtitle(seg.id, { style: { outlineOpacity: 25, backgroundOpacity: 75 } });
  store.getState().commitVisualSegment(seg.id, before);
  const style = serializeTimeline(store.getState().segments)[0].style;
  assert.equal(style.outlineOpacity, 25);
  assert.equal(style.backgroundOpacity, 75);
  store.getState().undo();
  assert.equal(store.getState().segments[0].style.outlineOpacity, 100);
});

test('SRT 毫秒、换行、BOM 和非法时间', () => {
  const result = parseSubtitleFile('\uFEFF1\r\n00:00:01,250 --> 00:00:03,500\r\n你好\r\nworld\r\n', 'srt');
  assert.equal(result.cues[0].start, 1.25);
  assert.equal(result.cues[0].duration, 2.25);
  assert.match(result.cues[0].text, /你好\nworld/);
  assert.throws(() => parseSubtitleFile('1\n00:00:03,000 --> 00:00:01,000\nbad', 'srt'));
  assert.throws(() => parseSubtitleFile('', 'srt'));
});
test('ASS 基础样式和高级效果警告', () => {
  const result = parseSubtitleFile('[Script Info]\nPlayResY: 1080\n[V4+ Styles]\nFormat: Name,Fontname,Fontsize,PrimaryColour,Alignment,Outline\nStyle: Default,Arial,48,&H000000FF,2,2\n[Events]\nFormat: Layer, Start, End, Style, Text\nDialogue: 0,0:00:01.00,0:00:03.00,Default,{\\k20}你好\\Nworld', 'ass');
  assert.equal(result.cues[0].style.color, '#FF0000');
  assert.equal(result.cues[0].text, '你好\nworld');
  assert.equal(result.warnings.length, 1);
});
test('导入保留原时间间隙，冲突分轨，整体撤销；超过六轨整次失败', () => {
  reset();
  const cues = Array.from({ length: 6 }, (_, i) => ({ text: `text${i}`, start: 4, duration: 2 }));
  store.getState().importSubtitles(cues);
  assert.equal(new Set(store.getState().segments.map((seg) => seg.track)).size, 6);
  assert.ok(store.getState().segments.every((seg) => seg.start === 4));
  const before = store.getState().segments;
  assert.throws(() => store.getState().importSubtitles([{ text: 'overflow', start: 5, duration: 1 }]));
  assert.equal(store.getState().segments, before);
  assert.equal(store.getState().past.length, 1);
  store.getState().undo();
  assert.equal(store.getState().segments.length, 0);
});
test('文字预览合并历史、切割保留文字、序列化保留样式', () => {
  reset();
  store.getState().importSubtitles([{ text: 'old', start: 0, duration: 4 }]);
  const seg = store.getState().segments[0];
  const before = { segments: store.getState().segments, selectedId: seg.id };
  for (const text of ['n', 'ne', 'new']) store.getState().previewSubtitle(seg.id, { text });
  store.getState().commitVisualSegment(seg.id, before);
  assert.equal(store.getState().past.length, 2);
  store.setState({ cursor: 2 });
  store.getState().splitSelected();
  assert.deepEqual(store.getState().segments.map((s) => [s.text, s.start, s.duration]), [['new', 0, 2], ['new', 2, 2]]);
  assert.equal(serializeTimeline(store.getState().segments)[0].text, 'new');
  assert.equal(serializeTimeline(store.getState().segments)[0].clip_id, undefined);
});
test('UTF-8 文件解码', async () => {
  const file = { name: 'test.srt', size: 80, arrayBuffer: async () => new TextEncoder().encode('1\n00:00:00,000 --> 00:00:01,000\n字幕').buffer };
  assert.equal((await readSubtitleFile(file)).cues[0].text, '字幕');
});

test('切换对齐保留坐标，描边开关保留宽度与颜色并支持撤销', () => {
  reset();
  store.getState().importSubtitles([{ text: '字幕', start: 0, duration: 3 }]);
  const seg = store.getState().segments[0];
  const before = { segments: store.getState().segments, selectedId: seg.id };
  store.getState().previewSubtitle(seg.id, { style: { align: 'right', outlineOn: false } });
  const next = store.getState().segments[0];
  assert.equal(next.style.x, seg.style.x);
  assert.equal(next.style.y, seg.style.y);
  assert.equal(next.style.outline, seg.style.outline);
  assert.equal(next.style.outlineColor, seg.style.outlineColor);
  assert.equal(serializeTimeline([next])[0].style.outlineOn, false);
  store.getState().commitVisualSegment(seg.id, before);
  store.getState().undo();
  assert.equal(store.getState().segments[0].style.align, seg.style.align);
});

test('字幕总时长保持起点、拒绝同轨重叠，背景颜色和开关支持撤销及序列化', () => {
  reset();
  store.getState().importSubtitles([{ text: 'first', start: 1, duration: 2 }, { text: 'next', start: 6, duration: 2 }]);
  const seg = store.getState().segments[0];
  const before = { segments: store.getState().segments, selectedId: seg.id };
  store.getState().previewSubtitle(seg.id, { duration: 4 });
  assert.equal(store.getState().segments[0].start, 1);
  assert.equal(store.getState().segments[0].duration, 4);
  store.getState().previewSubtitle(seg.id, { duration: 6 });
  assert.equal(store.getState().segments[0].duration, 4);
  store.getState().previewSubtitle(seg.id, { style: { background: '#336699', backgroundOn: true } });
  store.getState().commitVisualSegment(seg.id, before);
  assert.equal(serializeTimeline(store.getState().segments)[0].style.background, '#336699');
  assert.equal(store.getState().segments[0].style.backgroundOn, true);
  store.getState().undo();
  assert.equal(store.getState().segments[0].duration, 2);
  assert.equal(store.getState().segments[0].style.backgroundOn, false);
});
