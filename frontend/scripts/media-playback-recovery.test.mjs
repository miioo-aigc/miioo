import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createMediaPlaybackSession } from '../src/utils/MediaPlaybackSession.js';
class Media extends EventTarget {
  paused = true; readyState = 0; currentTime = 12; duration = 100; loads = 0; plays = 0;
  play() { this.plays++; this.paused = false; this.emit('play'); return new Promise((a,b) => { this.resolve = a; this.reject = b; }); }
  pause() { if (!this.paused) { this.paused = true; this.emit('pause'); } }
  load() { this.loads++; this.readyState = 0; this.currentTime = 0; this.error = null; }
  emit(name) { this.dispatchEvent(new Event(name)); }
}
const delay = ms => new Promise(r => setTimeout(r, ms));
function setup(timeoutMs = 30000) {
  const media = new Media(), network = new EventTarget(); network.navigator = { onLine: true };
  const states = [];
  const session = createMediaPlaybackSession(media, { network, timeoutMs, onChange: s => states.push(s) });
  return { media, session, states, net(name) { network.navigator.onLine = name === 'online'; network.dispatchEvent(new Event(name)); } };
}
test('等待不冒充播放，元数据预加载完成不要求整文件就绪', () => {
  const h = setup(); try { h.session.start(); assert.equal(h.session.getState().status, 'loading'); h.media.readyState = 1; h.media.emit('loadedmetadata'); assert.equal(h.session.getState().status, 'ready'); } finally { h.session.dispose(); }
});
test('超时退出等待，迟到play回执不恢复播放', async () => {
  const h = setup(10); try { const p = h.session.play(); await delay(25); assert.equal(h.session.getState().status, 'error'); assert.equal(h.media.paused, true); h.media.resolve(); assert.equal(await p, false); assert.equal(h.session.getState().status, 'error'); } finally { h.session.dispose(); }
});
test('网络恢复仅重载一次且不播放，保留进度，点击后播放', async () => {
  const h = setup(); try {
    h.media.emit('error'); h.net('offline'); h.net('online'); await delay(1100);
    assert.equal(h.media.loads, 1); assert.equal(h.media.plays, 0);
    h.media.readyState = 1; h.media.emit('loadedmetadata'); assert.equal(h.media.currentTime, 12);
    assert.equal(h.session.getState().requiresClick, true);
    await h.session.play({ automatic: true }); assert.equal(h.media.plays, 0);
    const p = h.session.play(); h.media.resolve(); await p; assert.equal(h.session.getState().status, 'playing');
    h.media.emit('error'); h.net('offline'); h.net('online'); await delay(1100); assert.equal(h.media.loads, 1);
    h.session.reload(); assert.equal(h.media.loads, 2); assert.equal(h.media.plays, 1);
  } finally { h.session.dispose(); }
});
test('恢复先于错误也能有限重载，正常媒体不会重载', async () => {
  const h = setup(); try { h.net('offline'); h.net('online'); await delay(1050); assert.equal(h.media.loads, 0); h.media.emit('error'); await delay(1100); assert.equal(h.media.loads, 1); } finally { h.session.dispose(); }
});
test('暂停撤销迟到播放，关闭后取消联网重载', async () => {
  const h = setup(); const p = h.session.play(); h.session.pause(); h.media.resolve(); assert.equal(await p, false); assert.equal(h.session.getState().status, 'paused');
  h.media.emit('error'); h.net('offline'); h.net('online'); h.session.dispose(); await delay(1100); assert.equal(h.media.loads, 0);
});
test('自动播放权限拒绝提示点击，不当作网络故障', async () => {
  const h = setup(); try { const p = h.session.play(); h.media.reject(Object.assign(Error(), { name: 'NotAllowedError' })); await p; assert.equal(h.session.getState().status, 'ready'); assert.equal(h.session.getState().message, '请点击播放'); } finally { h.session.dispose(); }
});
test('播放中缓冲超时，重新加载不自动出声', async () => {
  const h = setup(10); try { const p = h.session.play(); h.media.resolve(); await p; h.media.emit('waiting'); assert.equal(h.session.getState().status, 'loading'); await delay(25); assert.equal(h.session.getState().status, 'error'); h.session.reload(); assert.equal(h.media.plays, 1); } finally { h.session.dispose(); }
});
test('严格模式已销毁会话的延迟启动无副作用', async () => {
  const h = setup(); h.session.dispose(); h.session.start(); await h.session.play(); assert.equal(h.media.plays, 0); assert.equal(h.states.length, 0);
});

test('共享音频等待时不发布播放键，切换后旧回执不能覆盖新音频', async () => {
  const { readFileSync } = await import('node:fs');
  const source = readFileSync(new URL('../src/utils/voicePreviewPlayer.js', import.meta.url), 'utf8').replace(/^import .*;$/gm, '').replaceAll('export ', '');
  const network = new EventTarget(); network.navigator = { onLine: true };
  const audios = [];
  class AudioMock extends Media { constructor() { super(); audios.push(this); } removeAttribute() {} }
  const api = new Function('Audio', 'createMediaPlaybackSession', source + String.fromCharCode(10) + 'return { toggleVoicePreview, getActiveVoicePreviewKey, getVoicePreviewState, stopVoicePreview };')(AudioMock, (media, options) => createMediaPlaybackSession(media, { ...options, network }));
  try {
    const a = api.toggleVoicePreview({ key: 'a', url: '/a' });
    assert.equal(api.getActiveVoicePreviewKey(), ''); assert.equal(api.getVoicePreviewState().status, 'loading');
    const b = api.toggleVoicePreview({ key: 'b', url: '/b' }); audios[0].resolve(); await a;
    assert.equal(api.getVoicePreviewState().key, 'b'); audios[1].resolve(); await b;
    assert.equal(api.getActiveVoicePreviewKey(), 'b'); api.stopVoicePreview('a'); assert.equal(api.getActiveVoicePreviewKey(), 'b');
    api.stopVoicePreview('b'); assert.equal(api.getActiveVoicePreviewKey(), '');
  } finally { api.stopVoicePreview(); }
});

test('首次悬停权限拒绝仅静音降级一次，恢复后仍必须点击', async () => {
  const h = setup();
  try {
    h.media.muted = false;
    const p = h.session.play({ automatic: true, mutedFallback: true });
    h.media.reject(Object.assign(Error(), { name: 'NotAllowedError' }));
    await Promise.resolve();
    assert.equal(h.media.muted, true);
    assert.equal(h.media.plays, 2);
    h.media.resolve();
    assert.equal(await p, true);
    h.media.emit('error');
    h.session.reload();
    h.media.emit('loadedmetadata');
    await h.session.play({ automatic: true, mutedFallback: true });
    assert.equal(h.media.plays, 2);
    assert.equal(h.session.getState().requiresClick, true);
  } finally { h.session.dispose(); }
});


test('静音卡片恢复后悬停可播放，有声音频仍要求显式播放', async () => {
  const h = setup();
  try {
    h.media.muted = true;
    h.media.emit('error');
    h.session.reload();
    h.media.readyState = 1;
    h.media.emit('loadedmetadata');
    assert.equal(h.media.plays, 0);
    await h.session.play({ automatic: true });
    assert.equal(h.media.plays, 0);
    const resumed = h.session.play({ automatic: true, hover: true });
    h.media.resolve();
    assert.equal(await resumed, true);
    assert.equal(h.session.getState().status, 'playing');
    h.media.muted = false;
    h.media.emit('error');
    h.session.reload();
    h.media.emit('loadedmetadata');
    await h.session.play({ automatic: true, hover: true });
    assert.equal(h.media.plays, 1);
    assert.equal(h.session.getState().requiresClick, true);
  } finally { h.session.dispose(); }
});
