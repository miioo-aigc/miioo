// 审查证据：运行现有组件的状态与副作用代码，不访问真实媒体服务。
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/components/storyboard/StoryboardMediaPreview.jsx', import.meta.url), 'utf8');
const helpers = source.slice(source.indexOf('function isVideoMedia'), source.indexOf('function LoadingPreview'));
const component = source.slice(source.indexOf('  const video = isVideoMedia(media);', source.indexOf('export default function')), source.indexOf('  const resolvedPreview'));
const resolveExpression = source.match(/const resolvedPreview = ([^;]+);/)[1];

function setup() {
  const states = [];
  const videos = [];
  let cursor = 0, dependencies, cleanup, pending;
  const useState = initial => {
    const index = cursor++;
    if (!(index in states)) states[index] = initial;
    return [states[index], value => { states[index] = value; }];
  };
  const useEffect = (effect, deps) => {
    if (!dependencies || deps.some((value, index) => value !== dependencies[index])) {
      pending = effect;
      dependencies = deps;
    }
  };
  const document = { createElement(type) {
    if (type === 'canvas') return { getContext: () => ({ drawImage() {} }), toDataURL: () => 'data:frame-A' };
    const events = new Map();
    const video = {
      videoWidth: 320, videoHeight: 180, readyState: 2,
      addEventListener: (name, fn) => events.set(name, fn),
      removeEventListener: (name, fn) => { if (events.get(name) === fn) events.delete(name); },
      removeAttribute() {}, load() {}, emit: name => events.get(name)?.(),
    };
    videos.push(video);
    return video;
  } };
  const renderSource = new Function('useState', 'useEffect', 'document', 'normalizeImageUrl', 'media', helpers + component + `return { preview: ${resolveExpression}, captureFailed };`);
  return {
    states, videos,
    render(url) {
      cursor = 0;
      const result = renderSource(useState, useEffect, document, value => value, { media_type: 'video', url });
      if (pending) { const effect = pending; pending = null; cleanup?.(); cleanup = effect(); }
      return result;
    },
    dispose() { cleanup?.(); },
  };
}

const first = setup();
first.render('/A.mp4');
first.videos[0].emit('loadeddata');
assert.equal(first.render('/A.mp4').preview, 'data:frame-A');
assert.equal(first.render('/B.mp4').preview, 'data:frame-A');
first.videos[1].emit('error');
assert.equal(first.render('/B.mp4').preview, 'data:frame-A');
first.dispose();
console.log('已复现：同实例从视频A切换B后，B等待及失败时仍显示A首帧。');

const second = setup();
second.render('/A.mp4');
second.render('/B.mp4');
assert.equal(second.render('/B.mp4').captureFailed, false);
second.videos[0].emit('error');
assert.equal(second.render('/B.mp4').captureFailed, true);
second.dispose();
console.log('已复现：已清理的A视频错误回调仍可改写B的失败状态。');
