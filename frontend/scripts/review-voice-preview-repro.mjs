import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createMediaPlaybackSession } from '../src/utils/MediaPlaybackSession.js';
const source = readFileSync(new URL('../src/utils/voicePreviewPlayer.js', import.meta.url), 'utf8').replace(/^import .*;$/gm, '').replaceAll('export ', '');
const network = new EventTarget(); network.navigator = { onLine: true };
const audios = [];
class AudioMock extends EventTarget {
  paused = true; readyState = 0; currentTime = 0; loads = 0; plays = 0;
  constructor() { super(); audios.push(this); }
  play() { this.plays++; this.paused = false; this.dispatchEvent(new Event('play')); return new Promise(resolve => { this.resolve = resolve; }); }
  pause() { if (!this.paused) { this.paused = true; this.dispatchEvent(new Event('pause')); } }
  load() { this.loads++; }
  removeAttribute() {}
}
const api = new Function('Audio', 'createMediaPlaybackSession', source + '\nreturn { toggleVoicePreview, getActiveVoicePreviewKey, getVoicePreviewState, stopVoicePreview };')(AudioMock, (media, options) => createMediaPlaybackSession(media, { ...options, network, timeoutMs: 15 }));
try {
  const first = api.toggleVoicePreview({ key: 'voice', url: '/voice.mp3' });
  assert.equal(api.getVoicePreviewState().status, 'loading');
  assert.equal(api.getActiveVoicePreviewKey(), '');
  await api.toggleVoicePreview({ key: 'voice', url: '/voice.mp3' });
  assert.equal(api.getVoicePreviewState().status, 'paused');
  assert.equal(audios[0].plays, 1);
  audios[0].resolve(); await first;
  console.log('已复现：界面仍显示播放入口时，第二次点击实际暂停等待。');
  const pending = api.toggleVoicePreview({ key: 'voice', url: '/voice.mp3' });
  let settled = false; pending.then(() => { settled = true; }, () => { settled = true; });
  await new Promise(resolve => setTimeout(resolve, 30));
  assert.equal(api.getVoicePreviewState().status, 'error');
  assert.equal(api.getActiveVoicePreviewKey(), '');
  assert.equal(settled, false);
  console.log('已复现：会话超时已进入失败，旧播放键订阅不区分失败；调用方等待的播放承诺未结束，不能依赖 catch 展示超时。');
} finally { api.stopVoicePreview(); }
