import assert from 'node:assert/strict';
import { test } from 'node:test';
import { videoFrameDestination, openVideoFrameDestination } from '../src/utils/VideoFrameDestination.js';

test('选帧查看保留宿主入口且仅进入图片列表', () => {
  assert.equal(videoFrameDestination('/workspace/create'), '/workspace/create?tab=image');
  assert.equal(videoFrameDestination('/workspace/assets'), '/workspace/assets?module=creative&tab=image');
  assert.equal(videoFrameDestination('/project/p/storyboard'), null);
  assert.equal(videoFrameDestination(''), null);
});

test('查看采用同页历史导航，不刷新网页，不接受外部地址', () => {
  const calls = [];
  globalThis.window = { history: { pushState: (...args) => calls.push(args) }, dispatchEvent: (event) => calls.push(event.type) };
  globalThis.PopStateEvent = class { constructor(type) { this.type = type; } };
  try {
    openVideoFrameDestination('https://example.com');
    assert.equal(calls.length, 0);
    const href = videoFrameDestination('/workspace/assets');
    openVideoFrameDestination(href);
    assert.equal(calls[0][2], href);
    assert.equal(calls[1], 'popstate');
  } finally {
    delete globalThis.window;
    delete globalThis.PopStateEvent;
  }
});
