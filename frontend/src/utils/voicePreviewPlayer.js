import { createMediaPlaybackSession } from './MediaPlaybackSession';

let activeAudio = null;
let activePreviewKey = '';
let session = null;
let activeUrl = '';
let playback = { key: '', status: 'idle' };
const listeners = new Set();
const stateListeners = new Set();
function emit() {
  listeners.forEach(listener => { try { listener(getActiveVoicePreviewKey()); } catch { /* 单个订阅失败不阻断播放 */ } });
  stateListeners.forEach(listener => { try { listener(playback); } catch { /* 保留其他订阅 */ } });
}
export function getActiveVoicePreviewKey() {
  return playback.status === 'playing' ? activePreviewKey : '';
}
export function getVoicePreviewState() { return playback; }
export function subscribeVoicePreview(listener) { listeners.add(listener); return () => listeners.delete(listener); }
export function subscribeVoicePreviewState(listener) { stateListeners.add(listener); return () => stateListeners.delete(listener); }
export function stopVoicePreview(targetKey) {
  if ((targetKey && activePreviewKey !== targetKey) || !activeAudio) return false;
  session?.dispose(); session = null;
  activeAudio.removeAttribute('src'); activeAudio.load(); activeAudio = null;
  activePreviewKey = ''; activeUrl = ''; playback = { key: '', status: 'idle' }; emit();
  return true;
}
export function retryVoicePreview(key) {
  if (key === activePreviewKey) session?.reload();
}
async function playSession(current) {
  const result = await current.play();
  if (current === session && current.getState().status === 'error') throw new Error(current.getState().message);
  return result;
}
export async function toggleVoicePreview({ key, url }) {
  if (!key || !url) return false;
  if (activePreviewKey === key && activeUrl === url) {
    if (playback.status === 'playing' || playback.status === 'loading') { session.pause(); return false; }
    return playSession(session);
  }
  stopVoicePreview();
  const audio = new Audio(url);
  activeAudio = audio; activePreviewKey = key; activeUrl = url;
  session = createMediaPlaybackSession(audio, { onChange: state => {
    if (activeAudio !== audio) return;
    playback = { key, ...state }; emit();
  } });
  return playSession(session);
}
