import assert from 'node:assert/strict';
import test from 'node:test';
import { createTimelineMediaLoad } from '../src/utils/TimelineMediaLoad.js';
function setup(t, options = {}) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const image = new EventTarget(), video = new EventTarget(), network = new EventTarget();
  network.navigator = { onLine: true };
  network.document = new EventTarget();
  network.document.visibilityState = 'visible';
  let state, loads = 0, plays = 0;
  image.removeAttribute = () => {};
  video.removeAttribute = () => {};
  video.pause = () => {};
  video.load = () => { loads++; };
  video.play = async () => { plays++; };
  const session = createTimelineMediaLoad({ image, video, covers: ['/preview', '/poster'], videoSrc: '/video', network, onChange: value => { state = value; }, ...options });
  t.after(() => session.dispose());
  const emit = (target, name) => target.dispatchEvent(new Event(name));
  const visibility = value => { network.document.visibilityState = value; emit(network.document, 'visibilitychange'); };
  session.start();
  return { image, video, network, session, emit, visibility, get state() { return state; }, get loads() { return loads; }, get plays() { return plays; } };
}
test('预览图失败回退视频封面，成功后停止图片重试', t => {
  const h = setup(t);
  assert.equal(h.image.src, '/preview');
  h.emit(h.image, 'error');
  assert.equal(h.image.src, '/poster');
  h.emit(h.image, 'load');
  t.mock.timers.tick(120000);
  assert.equal(h.state.coverReady, true);
  assert.equal(h.loads, 0);
});
test('封面全部失败请求视频首帧，持续重试超过原有次数上限', t => {
  const h = setup(t);
  for (const wait of [1000, 3000, 8000, 15000, 30000, 30000]) {
    h.emit(h.image, 'error'); h.emit(h.image, 'error');
    assert.equal(h.image.src, '/poster');
    t.mock.timers.tick(wait);
    assert.equal(h.image.src, '/preview');
  }
  assert.ok(h.loads > 0);
  h.emit(h.video, 'loadeddata');
  assert.equal(h.state.frameReady, true);
  assert.equal(h.plays, 0);
});
test('后台和离线暂停重试，恢复前台及网络后继续', t => {
  const h = setup(t, { covers: [] });
  assert.equal(h.loads, 1);
  h.emit(h.video, 'error'); h.visibility('hidden');
  t.mock.timers.tick(120000); assert.equal(h.loads, 1);
  h.visibility('visible'); assert.equal(h.loads, 2);
  h.network.navigator.onLine = false; h.emit(h.network, 'offline');
  t.mock.timers.tick(120000); assert.equal(h.loads, 2);
  h.network.navigator.onLine = true; h.emit(h.network, 'online');
  assert.equal(h.loads, 3);
});
test('悬停失败保持成功封面，恢复后继续播放；移开不再播放', async t => {
  const h = setup(t);
  h.emit(h.image, 'load'); h.session.setHovered(true);
  h.emit(h.video, 'error');
  assert.equal(h.state.coverReady, true);
  t.mock.timers.tick(1000);
  h.emit(h.video, 'loadeddata'); await Promise.resolve(); await Promise.resolve();
  assert.equal(h.state.playing, true);
  h.session.setHovered(false);
  assert.equal(h.state.playing, false);
  const plays = h.plays;
  h.emit(h.video, 'canplay');
  assert.equal(h.plays, plays);
});
test('挂起请求超时自动重试，卸载后定时器和事件不能继续请求', t => {
  const h = setup(t, { covers: [], timeoutMs: 100 });
  t.mock.timers.tick(100); t.mock.timers.tick(1000);
  assert.equal(h.loads, 2);
  h.session.dispose(); const loads = h.loads;
  t.mock.timers.tick(120000); h.visibility('visible'); h.emit(h.video, 'error');
  assert.equal(h.loads, loads);
});

test('同一悬停的就绪事件不重复播放，后台迟到回执不能开始播放', async t => {
  const h = setup(t, { covers: [] });
  h.session.setHovered(true);
  h.emit(h.video, 'loadeddata'); h.emit(h.video, 'canplay');
  assert.equal(h.plays, 1);
  h.visibility('hidden'); await Promise.resolve(); await Promise.resolve();
  assert.equal(h.state.playing, false);
  h.emit(h.video, 'canplay'); assert.equal(h.plays, 1);
});

test('卡片真实渲染只挂载一个时间轴媒体会话', async () => {
  const { readFile } = await import('node:fs/promises');
  const { transformWithOxc } = await import('vite');
  const source = (await readFile(new URL('../src/components/storyboard/StoryboardFinalizedCard.jsx', import.meta.url), 'utf8'))
    .replace(/^import .*;\n/gm, '').replace('export default function', 'function');
  const { code } = await transformWithOxc(source, 'Card.jsx', { jsx: { runtime: 'classic', pragma: 'element', pragmaFrag: 'fragment' } });
  const element = (type, props, ...children) => ({ type, props, children });
  for (const hovered of [false, true]) {
    const render = new Function('element', 'fragment', 'useState', 'Button', 'DotsLoading', 'normalizeImageUrl', 'StoryboardTimelinePreview', code + '\nreturn StoryboardFinalizedCard;')(
      element, 'fragment', () => [hovered, () => {}], 'button', 'dots', value => value, 'timeline-preview');
    const tree = render({ shot: { number: 1 }, media: { media_type: 'video', preview_video_url: '/video' } });
    const preview = tree.children.filter(child => child?.type === 'timeline-preview');
    assert.equal(preview.length, 1);
    assert.equal(preview[0].props.hovered, hovered);
  }
});
