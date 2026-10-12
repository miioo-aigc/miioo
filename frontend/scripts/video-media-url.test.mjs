import test from 'node:test';
import assert from 'node:assert/strict';
import { toVideoMediaUrl } from '../src/utils/VideoMediaUrl.js';

const videoUrl = 'https://www.chengxvblog.top/media/origin/miioob-1302811912/raw/creation/global/videos/917373f333cd43d4b76f198a033bd2a0.mp4';

test('本地视频抽帧地址改走同源代理，保留路径、查询参数与片段', () => {
  assert.equal(toVideoMediaUrl(`${videoUrl}?token=test%2Bvalue#t=1`, true),
    '/__dev-media/media/origin/miioob-1302811912/raw/creation/global/videos/917373f333cd43d4b76f198a033bd2a0.mp4?token=test%2Bvalue#t=1');
});

test('生产环境保持原始媒体地址', () => {
  assert.equal(toVideoMediaUrl(videoUrl, false), videoUrl);
});

test('不改写第三方、其他路径、本地地址和异常输入', () => {
  for (const url of [
    undefined, null, '', 'blob:http://localhost:5173/test', 'data:video/mp4;base64,AAAA',
    '/media/origin/test.mp4', '/__dev-media/media/origin/test.mp4',
    'https://example.com/media/origin/test.mp4',
    'https://www.chengxvblog.top.evil.test/media/origin/test.mp4',
    'https://www.chengxvblog.top/uploads/test.mp4',
    'https://www.chengxvblog.top:8443/media/origin/test.mp4',
    'https://user:pass@www.chengxvblog.top/media/origin/test.mp4',
    'invalid-url',
  ]) assert.equal(toVideoMediaUrl(url, true), url);
});
